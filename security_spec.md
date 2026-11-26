# Firestore Security Specification (Phase 2)

## 1. Data Invariants
1. **Catalog Integrity**: Only verified active administrators (`adminUsers` or verified bootstrap admin `brandallanka@gmail.com`) may create, update, or delete `brands`, `categories`, `products`, `inventory`, `promotions`, or `siteSettings`.
2. **PII Isolation**: `customers`, `orders`, and `enquiries` contain Personally Identifiable Information (emails, phones, addresses). Unauthenticated or non-admin users CANNOT read (`get` or `list`), update, or delete any document in those collections.
3. **Public Enquiry Submission**: Visitors may `create` a document in `/enquiries/{enquiryId}` ONLY if the payload strictly passes `isValidEnquiryCreate(incoming())` (valid `type`, bounded strings, `status == 'new'`, `createdAt == request.time`, and zero extra shadow fields).
4. **Admin RBAC Protection**: Only `super_admin` (or verified bootstrap admin) may grant, alter, or revoke roles in `/adminUsers/{uid}`. Self-promotion by any user is denied.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on validated writes are checked against `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Fail with `PERMISSION_DENIED`)
1. **Unauthenticated Price Tampering**: Anonymous write to `/products/cyv-cinnamon-alba` altering `variants[0].priceLkr = 1`.
2. **Unauthenticated Stock Tampering**: Anonymous update to `/inventory/CYV-CINN-100G` setting `stockQuantity = 9999`.
3. **Customer Self-Escalation**: Non-admin authenticated user creating `/adminUsers/{uid}` with `role: 'super_admin'`.
4. **Email Spoofing**: Authenticated user with `email: 'brandallanka@gmail.com'` and `email_verified: false` attempting admin write.
5. **PII Directory Scrape**: Unauthenticated or non-admin `list` query on `/customers` or `/orders`.
6. **Enquiry Inbox Scrape**: Unauthenticated `get` or `list` on `/enquiries`.
7. **Shadow Field Injection on Enquiry**: Public `create` on `/enquiries/enq1` injecting `status: 'quoted'` or `isVerified: true`.
8. **Oversized String DoS**: Public `create` on `/enquiries/enq2` with 50,000-char `message`.
9. **Path ID Poisoning**: Creating `/enquiries/../../../etc/passwd` or >128 char doc ID.
10. **Order Tampering**: Non-admin creating or updating `/orders/ord1` with `paymentStatus: 'paid'`.
11. **Promotion Enumeration**: Non-admin `list` on `/promotions` to harvest private codes.
12. **Archived Product Exposure**: Unauthenticated `get` on `/products/{id}` where `isArchived == true` (for non-admin).
