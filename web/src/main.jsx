import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { brand } from './theme/tokens';
import './theme/brand.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: brand.primary,
          colorBgBase: brand.background,
          colorBgContainer: brand.surface,
          colorBgElevated: brand.surfaceElevated,
          colorBorder: brand.border,
          colorText: brand.textPrimary,
          colorTextSecondary: brand.textSecondary,
          borderRadius: 10,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Layout: {
            siderBg: brand.surface,
            headerBg: brand.surfaceElevated,
            bodyBg: brand.background,
          },
          Menu: {
            darkItemBg: brand.surface,
            darkSubMenuItemBg: brand.surface,
            darkItemSelectedBg: 'rgba(61,220,95,0.15)',
            darkItemSelectedColor: brand.primary,
            darkItemHoverBg: 'rgba(61,220,95,0.08)',
          },
          Table: {
            headerBg: brand.surfaceElevated,
            rowHoverBg: 'rgba(61,220,95,0.06)',
          },
          Card: {
            colorBgContainer: brand.surface,
          },
          Input: {
            colorBgContainer: brand.surfaceElevated,
          },
          Modal: {
            contentBg: brand.surface,
            headerBg: brand.surface,
          },
          Drawer: {
            colorBgElevated: brand.surface,
          },
        },
      }}
    >
      <BrowserRouter basename="/panel">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
