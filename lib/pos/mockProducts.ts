import { Category, Product } from './types';

export const categories: Category[] = [
  { id: '1', name: 'Beverages', icon: 'Coffee' },
  { id: '2', name: 'Food', icon: 'Utensils' },
  { id: '3', name: 'Desserts', icon: 'Cake' },
  { id: '4', name: 'Bakery', icon: 'Croissant' },
  { id: '5', name: 'Snacks', icon: 'Package' },
];

export const products: Product[] = [
  // Beverages
  {
    id: '1',
    name: 'Espresso',
    category: '1',
    price: 2.50,
    image: 'bg-amber-600',
    description: 'Classic espresso shot'
  },
  {
    id: '2',
    name: 'Cappuccino',
    category: '1',
    price: 4.00,
    image: 'bg-amber-500',
    description: 'Espresso with steamed milk'
  },
  {
    id: '3',
    name: 'Latte',
    category: '1',
    price: 4.50,
    image: 'bg-yellow-700',
    description: 'Espresso with creamy milk'
  },
  {
    id: '4',
    name: 'Americano',
    category: '1',
    price: 3.00,
    image: 'bg-amber-800',
    description: 'Espresso with hot water'
  },
  {
    id: '5',
    name: 'Iced Coffee',
    category: '1',
    price: 3.50,
    image: 'bg-blue-900',
    description: 'Cold brewed coffee'
  },
  
  // Food
  {
    id: '6',
    name: 'Caesar Salad',
    category: '2',
    price: 8.50,
    image: 'bg-green-700',
    description: 'Fresh greens with parmesan'
  },
  {
    id: '7',
    name: 'Chicken Sandwich',
    category: '2',
    price: 9.00,
    image: 'bg-yellow-900',
    description: 'Grilled chicken breast'
  },
  {
    id: '8',
    name: 'Pasta Carbonara',
    category: '2',
    price: 11.50,
    image: 'bg-yellow-600',
    description: 'Classic Italian pasta'
  },
  {
    id: '9',
    name: 'Veggie Wrap',
    category: '2',
    price: 7.50,
    image: 'bg-green-600',
    description: 'Fresh vegetables wrap'
  },
  {
    id: '10',
    name: 'Burger Deluxe',
    category: '2',
    price: 10.00,
    image: 'bg-red-900',
    description: 'Beef with all toppings'
  },
  
  // Desserts
  {
    id: '11',
    name: 'Chocolate Cake',
    category: '3',
    price: 5.50,
    image: 'bg-amber-900',
    description: 'Rich chocolate layers'
  },
  {
    id: '12',
    name: 'Tiramisu',
    category: '3',
    price: 6.00,
    image: 'bg-yellow-800',
    description: 'Italian classic dessert'
  },
  {
    id: '13',
    name: 'Cheesecake',
    category: '3',
    price: 5.00,
    image: 'bg-orange-200',
    description: 'New York style cheesecake'
  },
  {
    id: '14',
    name: 'Ice Cream',
    category: '3',
    price: 3.50,
    image: 'bg-pink-400',
    description: 'Assorted flavors'
  },
  
  // Bakery
  {
    id: '15',
    name: 'Croissant',
    category: '4',
    price: 3.50,
    image: 'bg-yellow-700',
    description: 'Buttery and flaky'
  },
  {
    id: '16',
    name: 'Bagel',
    category: '4',
    price: 2.50,
    image: 'bg-yellow-900',
    description: 'Fresh baked bagel'
  },
  {
    id: '17',
    name: 'Muffin',
    category: '4',
    price: 3.00,
    image: 'bg-orange-600',
    description: 'Blueberry muffin'
  },
  {
    id: '18',
    name: 'Donut',
    category: '4',
    price: 2.00,
    image: 'bg-pink-500',
    description: 'Glazed donut'
  },
  
  // Snacks
  {
    id: '19',
    name: 'Chips',
    category: '5',
    price: 2.00,
    image: 'bg-yellow-500',
    description: 'Crispy potato chips'
  },
  {
    id: '20',
    name: 'Nuts Mix',
    category: '5',
    price: 4.50,
    image: 'bg-amber-700',
    description: 'Mixed nuts assortment'
  },
  {
    id: '21',
    name: 'Granola Bar',
    category: '5',
    price: 2.50,
    image: 'bg-yellow-800',
    description: 'Healthy granola bar'
  },
  {
    id: '22',
    name: 'Chocolate Bar',
    category: '5',
    price: 2.50,
    image: 'bg-amber-900',
    description: 'Premium chocolate'
  },
];
