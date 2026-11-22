
import { auth, db } from "./firebase-config.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const GUEST_CART_KEY = "nexgen_guest_cart";

function getGuestCart() {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "{}");
}

function saveGuestCart(cart) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

export function getGuestCartCount() {
    return Object.values(getGuestCart())
        .reduce((total, item) => total + item.quantity, 0);
}

export async function addProductToCart(product, quantity = 1) {
    const productId = product.id || product.productId;

    if (!productId) {
        throw new Error("Product ID is missing.");
    }

    const qty = Math.max(1, Math.min(99, Number(quantity) || 1));

    if (auth.currentUser) {
        const itemRef = doc(
            db,
            "carts",
            auth.currentUser.uid,
            "items",
            productId
        );

        const existing = await getDoc(itemRef);
        const oldQuantity = existing.exists()
            ? Number(existing.data().quantity || 0)
            : 0;

        await setDoc(itemRef, {
            productId,
            quantity: Math.min(99, oldQuantity + qty),
            updatedAt: serverTimestamp()
        }, { merge: true });

        return;
    }

    const cart = getGuestCart();
    const oldQuantity = cart[productId]?.quantity || 0;

    cart[productId] = {
        productId,
        name: product.name,
        brand: product.brand || "",
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice || product.price || 0),
        imageUrl: product.imageUrl || "",
        quantity: Math.min(99, oldQuantity + qty)
    };

    saveGuestCart(cart);
}

export async function getCartItems() {
    if (!auth.currentUser) {
        return Object.values(getGuestCart());
    }

    const cartRef = collection(
        db,
        "carts",
        auth.currentUser.uid,
        "items"
    );

    const snapshot = await getDocs(cartRef);
    const items = [];

    for (const cartDoc of snapshot.docs) {
        const cartData = cartDoc.data();
        const productRef = doc(db, "products", cartDoc.id);
        const productSnapshot = await getDoc(productRef);

        if (!productSnapshot.exists()) continue;

        const product = productSnapshot.data();

        items.push({
            productId: cartDoc.id,
            name: product.name,
            brand: product.brand || "",
            price: Number(product.price || 0),
            originalPrice: Number(product.originalPrice || product.price || 0),
            imageUrl: product.imageUrl || "",
            quantity: Number(cartData.quantity || 1),
            stock: Number(product.stock || 0)
        });
    }

    return items;
}

export async function updateCartQuantity(productId, quantity) {
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        throw new Error("Quantity must be between 1 and 99.");
    }

    if (!auth.currentUser) {
        const cart = getGuestCart();

        if (cart[productId]) {
            cart[productId].quantity = qty;
            saveGuestCart(cart);
        }

        return;
    }

    await setDoc(
        doc(db, "carts", auth.currentUser.uid, "items", productId),
        {
            productId,
            quantity: qty,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
}

export async function removeCartItem(productId) {
    if (!auth.currentUser) {
        const cart = getGuestCart();
        delete cart[productId];
        saveGuestCart(cart);
        return;
    }

    await deleteDoc(
        doc(db, "carts", auth.currentUser.uid, "items", productId)
    );
}

export async function mergeGuestCart(user = auth.currentUser) {
    if (!user) return;

    const guestCart = getGuestCart();
    const guestItems = Object.values(guestCart);

    if (guestItems.length === 0) return;

    const batch = writeBatch(db);

    for (const item of guestItems) {
        const itemRef = doc(
            db,
            "carts",
            user.uid,
            "items",
            item.productId
        );

        const existing = await getDoc(itemRef);

        const oldQuantity = existing.exists()
            ? Number(existing.data().quantity || 0)
            : 0;

        batch.set(itemRef, {
            productId: item.productId,
            quantity: Math.min(99, oldQuantity + item.quantity),
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    await batch.commit();
    localStorage.removeItem(GUEST_CART_KEY);
}
