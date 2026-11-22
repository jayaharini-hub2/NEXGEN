
# NEXGEN - Firestore Database Schema

## 1. products
- name: string
- description: string
- price: number
- categoryId: string
- imageUrl: string
- stock: number
- isActive: boolean
- createdAt: timestamp
- updatedAt: timestamp

## 2. categories
- name: string
- description: string
- imageUrl: string
- isActive: boolean
- createdAt: timestamp
- updatedAt: timestamp

## 3. users
- name: string
- email: string
- phone: string
- role: customer or admin
- createdAt: timestamp

## 4. orders
- userId: string
- items: array of purchased product snapshots
- totalAmount: number
- shippingAddress: map
- paymentStatus: string
- orderStatus: string
- createdAt: timestamp

## 5. wishlists
- userId: string
- productIds: array
- updatedAt: timestamp
