/**
 * Utility functions for generating unique purchase codes and QR codes
 */

/**
 * Generates a unique purchase code that's different from the actual order ID
 * Format: FG-YYYY-XXXXXX (e.g., FG-2025-A3B7K9)
 */
export function generateUniquePurchaseCode(): string {
  const currentYear = new Date().getFullYear();
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters like I, L, O, 0, 1

  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return `FG-${currentYear}-${code}`;
}

/**
 * Generates QR code data containing purchase information
 */
export function generateQRCodeData(purchaseCode: string, orderDetails: {
  farmName?: string;
  totalAmount: number;
  purchaseDate: string;
  productName?: string;
}): string {
  const qrData = {
    type: 'FARM2GO_PURCHASE',
    code: purchaseCode,
    farm: orderDetails.farmName || 'Unknown Farm',
    amount: orderDetails.totalAmount,
    date: orderDetails.purchaseDate,
    product: orderDetails.productName || 'Farm Products',
    verified: true
  };

  return JSON.stringify(qrData);
}

/**
 * Validates if a purchase code follows the correct format
 */
export function isValidPurchaseCode(code: string): boolean {
  const regex = /^FG-\d{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
  return regex.test(code);
}