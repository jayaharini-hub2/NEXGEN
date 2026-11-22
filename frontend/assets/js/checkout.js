
import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { getCartItems } from "./cart-service.js";

const checkoutMessage = document.getElementById("checkout-message");
const checkoutContent = document.getElementById("checkout-content");
const checkoutForm = document.getElementById("checkout-form");
const placeOrderButton = document.getElementById("place-order-button");

const customerName = document.getElementById("customer-name");
const customerEmail = document.getElementById("customer-email");

const checkoutItems = document.getElementById("checkout-items");
const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutTotal = document.getElementById("checkout-total");

let currentUser = null;
let cartItems = [];

function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

function showMessage(message, isError = false) {
    checkoutMessage.textContent = message;
    checkoutMessage.classList.toggle("error", isError);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function renderCart(items) {
    if (!items.length) {
        checkoutContent.hidden = true;
        showMessage("Your cart is empty. Please add products first.", true);
        return;
    }

    let subtotal = 0;

    checkoutItems.innerHTML = items.map(item => {
        const price = Number(item.price || 0);
        const quantity = Number(item.quantity || 1);
        const itemTotal = price * quantity;

        subtotal += itemTotal;

        return `
            <div class="checkout-product">
                <span>
                    ${escapeHTML(item.name)}
                    <br>
                    <small>Qty: ${quantity}</small>
                </span>
                <strong>${formatPrice(itemTotal)}</strong>
            </div>
        `;
    }).join("");

    checkoutSubtotal.textContent = formatPrice(subtotal);
    checkoutTotal.textContent = formatPrice(subtotal);

    checkoutContent.hidden = false;
    showMessage("Your cart is ready for checkout.");
}

async function loadCheckout(user) {
    try {
        showMessage("Loading your checkout details...");

        const customerRef = doc(db, "customers", user.uid);
        const customerSnapshot = await getDoc(customerRef);

        if (!customerSnapshot.exists()) {
            throw new Error("Customer profile not found.");
        }

        const customer = customerSnapshot.data();

        if (customer.isActive === false) {
            throw new Error("Your account is inactive.");
        }

        customerName.value = customer.customerName || "";
        customerEmail.value = customer.email || user.email || "";

        cartItems = await getCartItems();

        renderCart(cartItems);

    } catch (error) {
        console.error("Checkout loading error:", error);
        showMessage(error.message || "Unable to load checkout.", true);
    }
}

async function placeOrder(event) {
    event.preventDefault();

    if (!currentUser) {
        window.location.href = "login.html?redirect=checkout.html";
        return;
    }

    if (!checkoutForm.reportValidity()) {
        return;
    }

    if (!cartItems.length) {
        showMessage("Your cart is empty.", true);
        return;
    }

    placeOrderButton.disabled = true;
    placeOrderButton.textContent = "Processing Order...";

    try {
        const shippingAddress = {
            fullName: customerName.value.trim(),
            email: customerEmail.value.trim(),
            phone: document.getElementById("customer-phone").value.trim(),
            address: document.getElementById("customer-address").value.trim(),
            city: document.getElementById("customer-city").value.trim(),
            state: document.getElementById("customer-state").value.trim(),
            pincode: document.getElementById("customer-pincode").value.trim()
        };

        const paymentMethod =
            document.querySelector('input[name="payment"]:checked')?.value ||
            "Cash on Delivery";

        // Get the latest cart items from Firestore.
        const cartRef = collection(
            db,
            "carts",
            currentUser.uid,
            "items"
        );

        const cartSnapshot = await getDocs(cartRef);

        if (cartSnapshot.empty) {
            throw new Error("Your Firestore cart is empty. Please refresh the page.");
        }

        const orderRef = doc(collection(db, "orders"));

        await runTransaction(db, async transaction => {

            // Read every product before performing transaction writes.
            const productRefs = cartSnapshot.docs.map(cartDoc =>
                doc(db, "products", cartDoc.id)
            );

            const productSnapshots = await Promise.all(
                productRefs.map(productRef => transaction.get(productRef))
            );

            const orderItems = [];
            let subtotal = 0;

            for (let index = 0; index < productSnapshots.length; index++) {
                const productSnapshot = productSnapshots[index];
                const cartDoc = cartSnapshot.docs[index];

                if (!productSnapshot.exists()) {
                    throw new Error("A product in your cart no longer exists.");
                }

                const product = productSnapshot.data();
                const quantity = Number(cartDoc.data().quantity || 1);

                if (product.isActive === false) {
                    throw new Error(`${product.name} is unavailable.`);
                }

                if (!Number.isInteger(quantity) || quantity < 1) {
                    throw new Error("Invalid product quantity.");
                }

                const price = Number(product.price || 0);

                if (!Number.isFinite(price) || price < 0) {
                    throw new Error(`Invalid price for ${product.name}.`);
                }

               // Validate available stock without modifying the product.
if (product.stock !== undefined && product.stock !== null) {
    const stock = Number(product.stock);

    if (!Number.isFinite(stock) || stock < quantity) {
        throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stock}`
        );
    }
}

                subtotal += price * quantity;

                orderItems.push({
                    productId: cartDoc.id,
                    name: product.name || "Product",
                    brand: product.brand || "",
                    price: price,
                    quantity: quantity,
                    imageUrl: product.imageUrl || ""
                });
            }

            const orderData = {
                orderId: orderRef.id,
                customerId: currentUser.uid,
                customerName: shippingAddress.fullName,
                email: shippingAddress.email,
                items: orderItems,
                subtotal: subtotal,
                deliveryFee: 0,
                total: subtotal,
                paymentMethod: paymentMethod,
                paymentStatus: "Pending",
                orderStatus: "Placed",
                shippingAddress: shippingAddress,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Save the order.
            transaction.set(orderRef, orderData);

            // Delete all cart documents in the same transaction.
            cartSnapshot.docs.forEach(cartDoc => {
                transaction.delete(cartDoc.ref);
            });
        });

        // Only runs after the transaction succeeds.
        showMessage("Order placed successfully!");

        window.location.href =
            `orders.html?placed=${encodeURIComponent(orderRef.id)}`;

    } catch (error) {
        console.error("Order placement error:", error);

        showMessage(
            error.message || "Unable to place your order. Please try again.",
            true
        );

        placeOrderButton.disabled = false;
        placeOrderButton.textContent = "Place Order →";
    }
}

checkoutForm.addEventListener("submit", placeOrder);

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html?redirect=checkout.html";
        return;
    }

    currentUser = user;
    await loadCheckout(user);
});
