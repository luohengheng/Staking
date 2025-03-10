import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "config";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import NavBar from "@/components/nav";
import type { NextComponentType, NextPageContext } from "next";
import { ConfigProvider } from "antd";
import theme from "@/theme/themeConfig";

const queryClient = new QueryClient();

type CustomCompoent = NextComponentType<NextPageContext, any, any> & {
  isShowNav?: boolean;
};

interface CustomAppProps extends AppProps {
  Component: CustomCompoent;
}

export default function App({ Component, pageProps }: CustomAppProps) {
  const componentStatus = () => {
    if (Component?.isShowNav) {
      return (
        <>
          <NavBar />
          <div className="showNav">
            <Component {...pageProps} />
          </div>
        </>
      );
    } else {
      return (
        <>
          <Component {...pageProps} />
        </>
      );
    }
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ConfigProvider theme={theme}>{componentStatus()}</ConfigProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
