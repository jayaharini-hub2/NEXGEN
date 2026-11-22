import { auth, db } from "./firebase-config.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const accountArea = document.getElementById("account-area");

// Detect GitHub Pages project path
const basePath = window.location.pathname.startsWith("/NEXGEN/")
    ? "/NEXGEN"
    : "";

// Page navigation paths
const loginPath = `${basePath}/pages/login.html`;
const ordersPath = `${basePath}/pages/orders.html`;

if (accountArea) {

    onAuthStateChanged(auth, async user => {

        accountArea.innerHTML = "";

        // =========================
        // NOT LOGGED IN
        // =========================
        if (!user) {

            const loginLink = document.createElement("a");

            loginLink.href = loginPath;
            loginLink.className = "button account-login";
            loginLink.textContent = "Login";

            accountArea.appendChild(loginLink);

            return;
        }

        // =========================
        // LOGGED IN
        // =========================
        let customerName = user.displayName || "My Account";

        try {

            const profile = await getDoc(
                doc(db, "customers", user.uid)
            );

            if (profile.exists()) {

                const data = profile.data();

                customerName =
                    data.customerName ||
                    data.name ||
                    customerName;
            }

        } catch (error) {

            console.error("Profile loading error:", error);

        }

        // =========================
        // PROFILE MENU
        // =========================
        const wrapper = document.createElement("div");
        wrapper.className = "account-menu";

        // Profile button
        const profileButton = document.createElement("button");

        profileButton.className = "button account-profile-button";
        profileButton.textContent = "Profile ▾";

        // Dropdown
        const dropdown = document.createElement("div");

        dropdown.className = "account-dropdown";
        dropdown.hidden = true;

        // Customer name
        const name = document.createElement("strong");
        name.textContent = customerName;

        // Customer email
        const email = document.createElement("p");
        email.textContent = user.email || "";

        // Orders link
        const ordersLink = document.createElement("a");

        ordersLink.href = ordersPath;
        ordersLink.textContent = "My Orders";

        // Logout button
        const logoutButton = document.createElement("button");

        logoutButton.textContent = "Logout";
        logoutButton.className = "account-logout";

        // =========================
        // LOGOUT
        // =========================
        logoutButton.addEventListener("click", async () => {

            try {

                await signOut(auth);

                window.location.href = loginPath;
            } catch (error) {

                console.error("Logout error:", error);

                alert("Unable to log out. Please try again.");

            }

        });

        // =========================
        // TOGGLE DROPDOWN
        // =========================
        profileButton.addEventListener("click", () => {

            dropdown.hidden = !dropdown.hidden;

        });

        // =========================
        // APPEND ELEMENTS
        // =========================
        dropdown.append(
            name,
            email,
            ordersLink,
            logoutButton
        );

        wrapper.append(
            profileButton,
            dropdown
        );

        accountArea.appendChild(wrapper);

    });

}