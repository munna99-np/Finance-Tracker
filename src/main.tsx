import './index.css'
import { applyTheme } from './lib/settings'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from './lib/auth'
const AppLayout = lazy(() => import('./routes/AppLayout'))
const DashboardPage = lazy(() => import('./routes/DashboardPage'))
const SignInPage = lazy(() => import('./routes/SignInPage'))
const TransactionsPage = lazy(() => import('./routes/TransactionsPage'))
const TransactionHistoryPage = lazy(() => import('./routes/TransactionHistoryPage'))
const AccountsPage = lazy(() => import('./routes/AccountsPage'))
const AccountStatementPage = lazy(() => import('./routes/AccountStatementPage'))
const CategoriesPage = lazy(() => import('./routes/CategoriesPage'))
const PartiesPage = lazy(() => import('./routes/PartiesPage'))
const ReportsPage = lazy(() => import('./routes/ReportsPage'))
const TransfersPage = lazy(() => import('./routes/TransfersPage'))
const StaffPage = lazy(() => import('./routes/StaffPage'))
const StaffAttendancePage = lazy(() => import('./routes/StaffAttendancePage'))
const StaffAttendanceReportPage = lazy(() => import('./routes/StaffAttendanceReportPage'))
const InventoryPage = lazy(() => import('./routes/InventoryPage'))
const InventoryItemsPage = lazy(() => import('./routes/InventoryItemsPage'))
const InventoryCategoriesPage = lazy(() => import('./routes/InventoryCategoriesPage'))
const InventoryPurchasesPage = lazy(() => import('./routes/InventoryPurchasesPage'))
const InventoryReportsPage = lazy(() => import('./routes/InventoryReportsPage'))
const InventoryStockPage = lazy(() => import('./routes/InventoryStockPage'))
const InventoryProjectPage = lazy(() => import('./routes/InventoryProjectPage'))
const CustomerStatementPage = lazy(() => import('./routes/CustomerStatementPage'))
const InvoicePage = lazy(() => import('./routes/InvoicePage'))
import { ErrorBoundary } from './components/ErrorBoundary'
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
          { path: 'transactions/history', element: <TransactionHistoryPage /> },
          { path: 'transfers', element: <TransfersPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'accounts/:accountId', element: <AccountStatementPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'parties', element: <PartiesPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'staff', element: <StaffPage /> },
          { path: 'staff/attendance', element: <StaffAttendancePage /> },
          { path: 'staff/attendance-report', element: <StaffAttendanceReportPage /> },
          { path: 'invoice', element: <InvoicePage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'inventory/stock', element: <InventoryStockPage /> },
          { path: 'inventory/items', element: <InventoryItemsPage /> },
          { path: 'inventory/categories', element: <InventoryCategoriesPage /> },
          { path: 'inventory/purchases', element: <InventoryPurchasesPage /> },
          { path: 'inventory/reports', element: <InventoryReportsPage /> },
          { path: 'inventory/customers/:partyId', element: <CustomerStatementPage /> },
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
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
              Loading...
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ErrorBoundary>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </StrictMode>
)





