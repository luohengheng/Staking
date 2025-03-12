import { useEffect, useState, useCallback } from 'react';
import { useAccount } from "wagmi";
import {
  writeContract,
  waitForTransactionReceipt,
  getAccount,
  getChains,
  getChainId,
  switchChain,
  connect,
  injected,
  getBalance,
  GetBalanceReturnType,
} from "@wagmi/core";
import { sepolia } from "wagmi/chains";
import { config } from "config";

// 自定义 Hook：判断当前环境
export const useEnvironment = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // useEffect 只会在客户端执行
    setIsClient(true);
  }, []);

  // 如果 isClient 为 false，说明是服务器环境
  return {
    isClient,
    isServer: !isClient,
  };
}

// 获取当前钱包信息，包括余额、链id、地址
export const useWalletInfo = (targetChainId: any) => {
  const { isClient } = useEnvironment();
  const { isConnected } = useAccount();
  const [balance, setBalance] = useState<GetBalanceReturnType | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const walletConnect = useCallback(async () => {
    try { 
      const res = await connect(config, {
        connector: injected(),
      });
      console.log(res);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const walletInfo = useCallback(async () => {
    try {
      const account = await getAccount(config);
      const balance = await getBalance(config, {
        address: account.address as `0x${string}`,
      });
      setAccount(account.address as `0x${string}`);
      setBalance(balance);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const chainIdInfo = useCallback(async () => {
    try {
      const chains = await getChainId(config);
      console.log(chains, targetChainId);
      if (chains !== targetChainId && targetChainId) {
        await switchChain(config, {chainId: targetChainId});
      }
      setChainId(chains);
    } catch (error) {
      console.log(error);
    }
  }, [targetChainId]);

  useEffect(() => {
    if (!isClient) return;
    if (!isConnected) {
      walletConnect();
      return
    }
    if (!chainId) {
      chainIdInfo();
      return
    }
    if (!balance) {
      walletInfo();
    }
  }, [isClient, walletInfo, balance, walletConnect, isConnected, chainId, chainIdInfo]);

  return {
    balance,
    chainId,
    account,
  }
}