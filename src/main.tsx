import './index.css'
import { applyTheme } from './lib/settings'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from './lib/auth'
import AppLayout from './routes/AppLayout'
import DashboardPage from './routes/DashboardPage'
import SignInPage from './routes/SignInPage'
import TransactionsPage from './routes/TransactionsPage'
import AccountsPage from './routes/AccountsPage'
import CategoriesPage from './routes/CategoriesPage'
import PartiesPage from './routes/PartiesPage'
import ReportsPage from './routes/ReportsPage'
import TransfersPage from './routes/TransfersPage'
import StaffPage from './routes/StaffPage'
import InventoryPage from './routes/InventoryPage'
import InventoryItemsPage from './routes/InventoryItemsPage'
import InventoryCategoriesPage from './routes/InventoryCategoriesPage'
import InventoryPurchasesPage from './routes/InventoryPurchasesPage'
import InventoryReportsPage from './routes/InventoryReportsPage'
import InventoryStockPage from './routes/InventoryStockPage'
import InventoryProjectPage from './routes/InventoryProjectPage'
import { ProtectedOutlet } from './lib/auth'

const router = createBrowserRouter([
  { path: '/signin', element: <SignInPage /> },
  {
    element: <ProtectedOutlet />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'transfers', element: <TransfersPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'parties', element: <PartiesPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'staff', element: <StaffPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'inventory/stock', element: <InventoryStockPage /> },
          { path: 'inventory/items', element: <InventoryItemsPage /> },
          { path: 'inventory/categories', element: <InventoryCategoriesPage /> },
          { path: 'inventory/purchases', element: <InventoryPurchasesPage /> },
          { path: 'inventory/reports', element: <InventoryReportsPage /> },
          { path: 'construction', element: <InventoryProjectPage /> },
        ],
      },
    ],
  },
])

// Apply persisted theme before rendering
try { applyTheme() } catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </StrictMode>
)
