import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { LoadingState } from "@/components/AsyncState"
import { RequireAdmin, RequireProvider } from "@/components/RouteGuard"
import { Toaster } from "@/components/ui/sonner"
import AdminLayout from "@/layout/AdminLayout"
import MarketingLayout from "@/layout/MarketingLayout"
import ProviderLayout from "@/layout/ProviderLayout"
import PublicBookingLayout from "@/layout/PublicBookingLayout"
import { useAuthStore } from "@/store/useAuthStore"

const AdminDashboardPage = lazy(() => import("@/page/AdminDashboardPage"))
const AdminLoginPage = lazy(() => import("@/page/AdminLoginPage"))
const AdminPaymentReviewsPage = lazy(() => import("@/page/AdminPaymentReviewsPage"))
const AdminWithdrawalsPage = lazy(() => import("@/page/AdminWithdrawalsPage"))
const AvailabilityPage = lazy(() => import("@/page/AvailabilityPage"))
const BookingCancelledPage = lazy(() => import("@/page/BookingCancelledPage"))
const BookingPage = lazy(() => import("@/page/BookingPage"))
const BookingSuccessPage = lazy(() => import("@/page/BookingSuccessPage"))
const BookingsPage = lazy(() => import("@/page/BookingsPage"))
const DashboardPage = lazy(() => import("@/page/DashboardPage"))
const HomePage = lazy(() => import("@/page/HomePage"))
const LoginPage = lazy(() => import("@/page/LoginPage"))
const NotFoundPage = lazy(() => import("@/page/NotFoundPage"))
const PaymentsPage = lazy(() => import("@/page/PaymentsPage"))
const ProfilePage = lazy(() => import("@/page/ProfilePage"))
const RegisterPage = lazy(() => import("@/page/RegisterPage"))
const ServicesPage = lazy(() => import("@/page/ServicesPage"))

export default function App() {
  const providerToken = useAuthStore((state) => state.providerToken)
  const adminToken = useAuthStore((state) => state.adminToken)

  return (
    <>
      <Suspense fallback={<LoadingState label="Preparing ServMi..." rows={4} />}>
        <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
        </Route>

        <Route path="/login" element={providerToken ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={providerToken ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

        <Route element={<PublicBookingLayout />}>
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
          <Route path="/booking/cancelled" element={<BookingCancelledPage />} />
        </Route>

        <Route element={<RequireProvider />}>
          <Route element={<ProviderLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/availability" element={<AvailabilityPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="/admin/login" element={adminToken ? <Navigate to="/admin" replace /> : <AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
            <Route path="/admin/payment-reviews" element={<AdminPaymentReviewsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}
