
import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const ADMIN_UID = "9RyjGYS4Q5gRjuS0wX6H86LOy2m2";

const adminMessage = document.getElementById("admin-message");
const productForm = document.getElementById("product-form");
const productsTable = document.getElementById("products-table");
const ordersTable = document.getElementById("orders-table");

const productIdInput = document.getElementById("product-id");
const productName = document.getElementById("product-name");
const productBrand = document.getElementById("product-brand");
const productCategory = document.getElementById("product-category");
const productPrice = document.getElementById("product-price");
const productOriginalPrice = document.getElementById("product-original-price");
const productStock = document.getElementById("product-stock");
const productImage = document.getElementById("product-image");
const productActive = document.getElementById("product-active");

const saveProductButton = document.getElementById("save-product-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

let productsCache = [];

function showMessage(message, isError = false) {
    adminMessage.textContent = message;
    adminMessage.classList.toggle("error", isError);
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

function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
}

function formatDate(timestamp) {
    if (!timestamp) return "N/A";

    const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString("en-IN");
}

async function loadDashboard() {
    try {
        showMessage("Loading dashboard...");

        const [productsSnapshot, ordersSnapshot, customersSnapshot] =
            await Promise.all([
                getDocs(collection(db, "products")),
                getDocs(collection(db, "orders")),
                getDocs(collection(db, "customers"))
            ]);

        productsCache = productsSnapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        const orders = ordersSnapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        document.getElementById("total-products").textContent =
            productsCache.length;

        document.getElementById("total-orders").textContent =
            orders.length;

        document.getElementById("total-customers").textContent =
            customersSnapshot.size;

        const totalSales = orders
            .filter(order => order.orderStatus !== "Cancelled")
            .reduce((total, order) => total + Number(order.total || 0), 0);

        document.getElementById("total-sales").textContent =
            formatPrice(totalSales);

        renderProducts();
        renderOrders(orders);

        showMessage("Dashboard loaded successfully.");

    } catch (error) {
        console.error("Dashboard loading error:", error);
        showMessage(
            error.message || "Unable to load dashboard.",
            true
        );
    }
}

// ---------------- PRODUCT MANAGEMENT ----------------

function renderProducts() {
    if (!productsCache.length) {
        productsTable.innerHTML = `
            <tr>
                <td colspan="6">No products found.</td>
            </tr>
        `;
        return;
    }

    productsTable.innerHTML = productsCache.map(product => `
        <tr>
            <td class="product-name-cell">
                ${escapeHTML(product.name || "Unnamed Product")}
            </td>

            <td>${escapeHTML(product.category || "N/A")}</td>

            <td>${formatPrice(product.price)}</td>

            <td>${Number(product.stock ?? 0)}</td>

            <td>${product.isActive === false ? "Inactive" : "Active"}</td>

            <td>
                <button
                    class="table-button edit-button"
                    data-action="edit-product"
                    data-id="${escapeHTML(product.id)}">
                    Edit
                </button>

                <button
                    class="table-button delete-button"
                    data-action="delete-product"
                    data-id="${escapeHTML(product.id)}">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

function resetProductForm() {
    productForm.reset();
    productIdInput.value = "";
    productActive.checked = true;

    document.getElementById("product-form-title").textContent =
        "Add New Product";

    saveProductButton.textContent = "Add Product";
    cancelEditButton.hidden = true;
}

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = productName.value.trim();
    const category = productCategory.value.trim();
    const price = Number(productPrice.value);
    const originalPrice = productOriginalPrice.value === ""
        ? price
        : Number(productOriginalPrice.value);
    const stock = Number(productStock.value);

    if (!name || !category || !Number.isFinite(price) ||
        !Number.isFinite(originalPrice) || !Number.isInteger(stock) ||
        price < 0 || originalPrice < 0 || stock < 0) {
        showMessage("Please enter valid product details.", true);
        return;
    }

    const productData = {
        name,
        brand: productBrand.value.trim(),
        category,
        price,
        originalPrice,
        stock,
        imageUrl: productImage.value.trim(),
        isActive: productActive.checked,
        updatedAt: serverTimestamp()
    };

    saveProductButton.disabled = true;
    saveProductButton.textContent = "Saving...";

    try {
        if (productIdInput.value) {
            const productRef = doc(
                db,
                "products",
                productIdInput.value
            );

            await updateDoc(productRef, productData);

            showMessage("Product updated successfully.");
        } else {
            productData.createdAt = serverTimestamp();

            await addDoc(
                collection(db, "products"),
                productData
            );

            showMessage("Product added successfully.");
        }

        resetProductForm();
        await loadDashboard();

    } catch (error) {
        console.error("Product save error:", error);
        showMessage(error.message || "Unable to save product.", true);
    } finally {
        saveProductButton.disabled = false;
        saveProductButton.textContent =
            productIdInput.value ? "Update Product" : "Add Product";
    }
});

productsTable.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const product = productsCache.find(
        item => item.id === button.dataset.id
    );

    if (!product) return;

    if (button.dataset.action === "edit-product") {
        productIdInput.value = product.id;
        productName.value = product.name || "";
        productBrand.value = product.brand || "";
        productCategory.value = product.category || "";
        productPrice.value = product.price ?? "";
        productOriginalPrice.value = product.originalPrice ?? "";
        productStock.value = product.stock ?? 0;
        productImage.value = product.imageUrl || "";
        productActive.checked = product.isActive !== false;

        document.getElementById("product-form-title").textContent =
            "Edit Product";

        saveProductButton.textContent = "Update Product";
        cancelEditButton.hidden = false;

        document.getElementById("product-form-title")
            .scrollIntoView({ behavior: "smooth" });
    }

    if (button.dataset.action === "delete-product") {
        const confirmed = confirm(
            `Are you sure you want to delete "${product.name}"?`
        );

        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, "products", product.id));

            showMessage("Product deleted successfully.");
            await loadDashboard();

        } catch (error) {
            console.error("Product delete error:", error);
            showMessage(error.message || "Unable to delete product.", true);
        }
    }
});

cancelEditButton.addEventListener("click", resetProductForm);


// ---------------- ORDER MANAGEMENT ----------------

function renderOrders(orders) {
    if (!orders.length) {
        ordersTable.innerHTML = `
            <tr>
                <td colspan="8">No orders found.</td>
            </tr>
        `;
        return;
    }

    orders.sort((a, b) => {
        const dateA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : 0;

        const dateB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : 0;

        return dateB - dateA;
    });

    ordersTable.innerHTML = orders.map(order => `
        <tr>
            <td>${escapeHTML(order.orderId || order.id)}</td>

            <td>${escapeHTML(order.customerName || "Customer")}</td>

            <td>${formatDate(order.createdAt)}</td>

            <td>${formatPrice(order.total)}</td>

            <td>${escapeHTML(order.paymentMethod || "N/A")}</td>

            <td>${escapeHTML(order.orderStatus || "Placed")}</td>

            <td>${escapeHTML(order.paymentStatus || "Pending")}</td>

            <td>
                <select
                    class="status-select"
                    id="status-${escapeHTML(order.id)}">

                    ${["Placed", "Processing", "Shipped", "Delivered", "Cancelled"]
                        .map(status => `
                            <option
                                value="${status}"
                                ${status === (order.orderStatus || "Placed") ? "selected" : ""}>
                                ${status}
                            </option>
                        `).join("")}

                </select>

                <button
                    class="status-save-button"
                    data-action="update-order"
                    data-id="${escapeHTML(order.id)}">
                    Save
                </button>
            </td>
        </tr>
    `).join("");
}


// UPDATE ORDER STATUS

ordersTable.addEventListener("click", async event => {

    const button = event.target.closest(
        'button[data-action="update-order"]'
    );

    if (!button) return;

    const orderId = button.dataset.id;

    const statusSelect = document.getElementById(
        `status-${orderId}`
    );

    if (!statusSelect) return;

    const newStatus = statusSelect.value;

    try {

        button.disabled = true;
        button.textContent = "Saving...";

        const updateData = {
            orderStatus: newStatus,
            updatedAt: serverTimestamp()
        };

        // Mark payment as paid when delivery is confirmed.
        // This assumes payment is collected upon delivery.
        if (newStatus === "Delivered") {
            updateData.paymentStatus = "Paid";
        }

        await updateDoc(
            doc(db, "orders", orderId),
            updateData
        );

        showMessage(
            newStatus === "Delivered"
                ? "Order delivered and payment status updated."
                : "Order status updated successfully."
        );

        await loadDashboard();

    } catch (error) {

        console.error("Order update error:", error);

        showMessage(
            error.message || "Unable to update order.",
            true
        );

    } finally {

        button.disabled = false;
        button.textContent = "Save";

    }

});

// ---------------- ADMIN AUTHENTICATION ----------------

document.getElementById("admin-logout").addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout error:", error);
        showMessage("Unable to log out.", true);
    }
});

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    if (user.uid !== ADMIN_UID) {
        alert("Access denied. Admin only.");
        window.location.href = "../index.html";
        return;
    }

    await loadDashboard();
});
