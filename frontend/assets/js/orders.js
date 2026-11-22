
import { auth, db } from "./firebase-config.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const ordersMessage = document.getElementById("orders-message");
const ordersList = document.getElementById("orders-list");
const emptyOrders = document.getElementById("empty-orders");

function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
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

function formatDate(timestamp) {
    if (!timestamp) return "Date unavailable";

    const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getStatusClass(status) {
    const normalized = String(status || "Placed").toLowerCase();

    const allowedStatuses = [
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
    ];

    return allowedStatuses.includes(normalized)
        ? `status-${normalized}`
        : "status-placed";
}

function renderOrder(order) {
    const items = Array.isArray(order.items) ? order.items : [];

    const orderItemsHTML = items.map(item => {
        const name = escapeHTML(item.name || "Product");
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);

        return `
            <div class="order-item">
                <div class="order-item-info">
                    <span class="order-item-name">${name}</span>
                    <span class="order-item-quantity">
                        Quantity: ${quantity}
                    </span>
                </div>

                <span class="order-item-price">
                    ${formatPrice(price * quantity)}
                </span>
            </div>
        `;
    }).join("");

    const address = order.shippingAddress || {};

    const deliveryAddress = [
        address.address,
        address.city,
        address.state,
        address.pincode
    ].filter(Boolean).map(escapeHTML).join(", ");

    const status = order.orderStatus || "Placed";

    return `
        <article class="order-card">

            <div class="order-top">
                <div>
                    <div class="order-number">
                        Order #${escapeHTML(order.orderId || order.id)}
                    </div>

                    <div class="order-date">
                        ${formatDate(order.createdAt)}
                    </div>
                </div>

                <span class="order-status ${getStatusClass(status)}">
                    ${escapeHTML(status)}
                </span>
            </div>

            <div class="order-body">

                <div class="order-items">
                    ${orderItemsHTML || "<p>No product details available.</p>"}
                </div>

                <div class="order-details">

                    <div class="order-detail">
                        <h4>Delivery Address</h4>

                        <p>
                            ${escapeHTML(address.fullName || order.customerName || "")}
                            <br>
                            ${deliveryAddress || "Address unavailable"}
                            <br>
                            ${escapeHTML(address.phone || "")}
                        </p>
                    </div>

                    <div class="order-detail">
                        <h4>Payment Information</h4>

                        <p>
                            Method: ${escapeHTML(order.paymentMethod || "N/A")}
                            <br>
                            Payment Status: ${escapeHTML(order.paymentStatus || "Pending")}
                        </p>
                    </div>

                </div>

            </div>

            <div class="order-bottom">

                <span class="order-payment">
                    ${items.length} product(s) in this order
                </span>

                <span class="order-total">
                    ${formatPrice(order.total)}
                </span>

            </div>

        </article>
    `;
}

async function loadOrders(user) {
    try {
        ordersMessage.textContent = "Loading your orders...";

        const ordersRef = collection(db, "orders");

        const ordersQuery = query(
            ordersRef,
            where("customerId", "==", user.uid)
        );

        const snapshot = await getDocs(ordersQuery);

        if (snapshot.empty) {
            ordersMessage.textContent = "";
            emptyOrders.hidden = false;
            ordersList.innerHTML = "";
            return;
        }

        const orders = snapshot.docs.map(orderDoc => ({
            id: orderDoc.id,
            ...orderDoc.data()
        }));

        // Sort newest orders first.
        orders.sort((a, b) => {
            const dateA = a.createdAt?.toMillis
                ? a.createdAt.toMillis()
                : 0;

            const dateB = b.createdAt?.toMillis
                ? b.createdAt.toMillis()
                : 0;

            return dateB - dateA;
        });

        ordersList.innerHTML = orders.map(renderOrder).join("");

        ordersMessage.textContent = `You have ${orders.length} order(s).`;
        emptyOrders.hidden = true;

        const placedOrderId = new URLSearchParams(
            window.location.search
        ).get("placed");

        if (placedOrderId) {
            ordersMessage.textContent =
                "Your order has been placed successfully!";
        }

    } catch (error) {
        console.error("Order history error:", error);

        ordersMessage.textContent =
            "Unable to load your orders. Please refresh and try again.";

        ordersMessage.classList.add("error");
    }
}

auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html?redirect=orders.html";
        return;
    }

    loadOrders(user);
});
