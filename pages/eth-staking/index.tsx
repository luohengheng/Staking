import { useState, useEffect } from "react";
import styles from "./index.module.css";
import { Button } from "@/components/ui/button";
import { useEnvironment } from "@/utils/customHooks";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useBalance,
  useReadContract,
  useReadContracts,
  useWatchContractEvent,
} from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { config } from "@/config";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther } from "viem";
import { stakingABI } from "@/abis/StakingABI.js";

//todo sepolia网络
const StakingContractAddress = "0x723C6b5909acc2dC4043D9cA91E9c7Fa0e62E800";
const GistTokenAddress = "0x38031Db3fBc02ED2280B71Fa2c33b1E07345F579";

const stakingContractConfig = {
  address: StakingContractAddress as `0x${string}`,
  abi: stakingABI,
};

const ETHStaking = () => {
  const { isClient } = useEnvironment();
  const { address, chain, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data } = useBalance({
    address,
    query: { enabled: isConnected },
  });
  const { data: rContractData, refetch: refetchContractData } = useReadContracts({
    contracts: [
      {
        ...stakingContractConfig,
        functionName: "totalStaked",
      },
      {
        ...stakingContractConfig,
        functionName: "totalReleased",
      },
      {
        ...stakingContractConfig,
        functionName: "stakingRewards",
      },
      {
        ...stakingContractConfig,
        functionName: "stakes",
        args: [address],
      },
      {
        ...stakingContractConfig,
        functionName: "rewards",
        args: [address],
      },
    ],
    query: {
      enabled: isConnected,
    },
  });

  // 事件监听
  useWatchContractEvent({
    ...stakingContractConfig,
    eventName: "Staked",
    onLogs(logs) {
      console.log("Staked", logs);
      refetchContractData()
    },
  });
  useWatchContractEvent({
    ...stakingContractConfig,
    eventName: "Unstaked",
    onLogs(logs) {
      console.log("Unstaked", logs);
      refetchContractData()
    }
  });
  useWatchContractEvent({
    ...stakingContractConfig,
    eventName: "RewardPaid",
    onLogs(logs) {
      console.log("RewardPaid", logs);
      refetchContractData()
    },
  });

  useEffect(() => {
    if (!isClient) return;
    if (isClient && !isConnected && connect) {
      // 自动连接签包
      connect({ connector: injected() });
    }
  }, [isClient, isConnected, connect]);

  // 质押0.0001ETH
  const stake = async () => {
    try {
      const stakeHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "stake",
        args: [],
        value: parseEther("0.00000000001"),
      });
      await waitForTransactionReceipt(config, { hash: stakeHash });
    } catch (error) {
      console.error(error);
    }
  };
  // 解押
  const unstake = async (amount: string) => {
    try {
      const unstakeHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "unstake",
        args: [parseEther(amount)],
      });
      await waitForTransactionReceipt(config, { hash: unstakeHash });
    } catch (error) {
      console.error(error);
    }
  };

  // 领取奖励
  const claimRewards = async () => {
    try {
      const claimRewardsHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "claimRewards",
      });
      await waitForTransactionReceipt(config, { hash: claimRewardsHash });
    } catch (error) {
      console.error(error);
    }
  };

  if (!isClient) return null;
  return (
    <div className={styles.container}>
      <div className={styles.title}>ETH Staking</div>
      <div className={styles.accountInfo}>
        <p>地址：{address}</p>
        <p>链：{chain?.id}</p>
        <p>链名：{chain?.name}</p>
        <p>
          余额：{formatEther(data?.value ?? BigInt(0))} {data?.symbol}
        </p>
      </div>
      <div className={styles.title}>质押相关</div>
      <div className={styles.status}>
        <div className={styles.statusItem}>
          <span>质押总量: </span>
          <span>
            {formatEther((rContractData?.[0]?.result as bigint) ?? BigInt(0))}
            ETH
          </span>
        </div>
        <div className={styles.statusItem}>
          <span>质押释放总量: </span>
          <span>
            {formatEther((rContractData?.[1]?.result as bigint) ?? BigInt(0))}
            ETH
          </span>
        </div>
        <div className={styles.statusItem}>
          <span>质押总奖励: </span>
          <span>
            {formatEther((rContractData?.[2]?.result as bigint) ?? BigInt(0))}
            token
          </span>
        </div>
        <div className={styles.statusItem}>
          <span>用户地址对应的质押数量: </span>
          <span>
            {formatEther((rContractData?.[3]?.result as unknown as bigint[])?.at(0) ?? BigInt(0))}
            ETH
          </span>
        </div>
        <div className={styles.statusItem}>
          <span>用户地址对应的奖励数量: </span>
          <span>
            {formatEther((rContractData?.[4]?.result as bigint) ?? BigInt(0))}
            个
          </span>
        </div>
      </div>
      <Button className={styles.btnR20} onClick={stake}>
        质押 0.00001ETH
      </Button>
      <Button className={styles.btnR20} onClick={() => unstake("0.00001")}>
        解质押 0.00001ETH
      </Button>
      <Button className={styles.btnR20} onClick={claimRewards}>
        领取质押奖励
      </Button>
    </div>
  );
};

ETHStaking.isShowNav = true;
export default ETHStaking;
