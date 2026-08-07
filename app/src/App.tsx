import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { LoginPage } from './auth/LoginPage'
import { ThemeProvider } from './components/layout/ThemeProvider'
import { ToastProvider } from './components/ui/Toast'
import { AppShell } from './components/layout/AppShell'
import { NAV_ITEMS } from './components/layout/navConfig'
import { KitchenSinkPage } from './features/kitchen-sink/KitchenSinkPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  {NAV_ITEMS.map((item) => {
                    const Page = item.page
                    return (
                      <Route
                        key={item.path}
                        path={item.path}
                        element={
                          <RequireRole allowed={item.roles}>
                            <Page />
                          </RequireRole>
                        }
                      />
                    )
                  })}
                </Route>
              </Route>
              {/*
                Design verification surface. Dev-only, and deliberately outside
                RequireAuth: it renders hardcoded fixtures with zero data access,
                so gating it would mean needing production credentials to review
                a component gallery. `import.meta.env.DEV` strips it from
                production builds entirely.
              */}
              {import.meta.env.DEV && (
                <Route path="/kitchen-sink" element={<KitchenSinkPage />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
