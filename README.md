# POS (Point of Sale) System

A modern, high-performance point of sale interface built with Next.js 16, React 19, and Tailwind CSS. Designed for touchscreen retail environments with an intuitive three-section layout inspired by Odoo POS.

## Features

- **Three-Column Layout**: Categories sidebar, product grid, and sticky order summary panel
- **Product Management**: Browse products by category with responsive grid display
- **Shopping Cart**: Add/remove items with quantity controls and real-time calculations
- **Payment Processing**: Support for both cash and card payments with change calculations
- **Real-time Calculations**: Automatic subtotal, tax, and total updates
- **Toast Notifications**: User feedback for all actions
- **Keyboard Shortcuts**: Press `Delete` to clear cart, `Escape` to close payment modal
- **Responsive Design**: Optimized for desktop, tablet, and mobile displays
- **Modern UI**: Clean, professional design with dark theme and smooth animations

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Icons**: lucide-react
- **State Management**: React Context API with custom hooks

## Project Structure

```
components/pos/
├── POSLayout.tsx           # Main layout container
├── TopBar.tsx              # Navigation and status bar
├── CategoriesSidebar.tsx   # Product category tabs
├── ProductGrid.tsx         # Responsive product grid
├── ProductCard.tsx         # Individual product card
├── OrderPanel.tsx          # Sticky order summary panel
├── CartItem.tsx            # Cart item with controls
├── OrderSummary.tsx        # Subtotal, tax, total display
├── PayButton.tsx           # Payment action button
├── PaymentModal.tsx        # Payment modal dialog
├── PaymentMethods.tsx      # Cash/Card selection
├── CashPayment.tsx         # Cash payment flow
└── CardPayment.tsx         # Card payment flow

hooks/
├── usePOSState.ts          # Cart state management
└── useCalculations.ts      # Tax and total calculations

lib/pos/
├── types.ts                # TypeScript interfaces
└── mockProducts.ts         # Sample product data
```

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repo-url>

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

The application will be available at `http://localhost:3000`

## Usage

### Adding Products to Cart

1. Click on a product card to add it to the cart
2. View the item in the right panel with quantity controls
3. Use the +/- buttons to adjust quantities
4. Click the trash icon to remove items

### Processing Payments

1. Click the "Pay $X.XX" button in the order panel
2. Select payment method (Cash or Card)
3. **For Cash**: Enter the amount received and confirm payment
4. **For Card**: Enter card details and confirm payment
5. Confirm the transaction on the success screen

### Keyboard Shortcuts

- **Delete**: Clear all items from cart
- **Escape**: Close payment modal

### Category Navigation

- Click on category icons in the left sidebar to filter products
- Categories include: Beverages, Food, Desserts, Bakery, and Snacks

## Features Walkthrough

### Product Catalog

- 22 pre-loaded products across 5 categories
- Each product displays name, price, and visual indicator
- Smooth hover animations and active states
- Touch-optimized for retail environments

### Order Management

- Real-time cart updates as items are added/removed
- Quantity adjustments with +/- controls
- Automatic tax calculation (8% by default)
- Clear summary of subtotal, tax, and total

### Payment Flow

**Cash Payment**:
- Enter cash amount received
- Quick preset buttons ($10, $20, $50)
- Automatic change calculation
- Real-time validation

**Card Payment**:
- Card number input with auto-formatting
- Expiry date field (MM/YY)
- CVV verification
- Masked card display for security

## Customization

### Changing Tax Rate

Edit `hooks/useCalculations.ts`:
```typescript
const TAX_RATE = 0.10; // Change to 10%
```

### Adding Products

Edit `lib/pos/mockProducts.ts` to add new products:
```typescript
{
  id: '23',
  name: 'New Product',
  category: '1',
  price: 9.99,
  image: 'bg-color-class',
  description: 'Product description'
}
```

### Customizing Colors

Edit `app/globals.css` to modify the theme colors:
```css
:root {
  --primary: oklch(0.5 0.15 41);
  --accent: oklch(0.65 0.2 41);
  /* ... other colors */
}
```

## Performance Optimization

- **Memoized Components**: ProductCard uses React.memo to prevent unnecessary re-renders
- **Efficient State Updates**: Cart operations are optimized with proper dependency arrays
- **CSS Grid Layout**: Uses native CSS Grid for responsive product display
- **Lazy Animations**: Smooth transitions optimized for performance

## Accessibility

- Proper ARIA labels on interactive elements
- Keyboard navigation support
- High contrast text for visibility in retail environments
- Touch-friendly button sizing (min 48px)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- Customer management system
- Discount code system
- Order notes and special instructions
- Receipt printing
- Barcode scanning
- Dark/light theme toggle
- Real-time inventory tracking
- Sales analytics dashboard

## License

MIT License - feel free to use this project for commercial purposes.

## Support

For issues or feature requests, please create an issue in the repository.
