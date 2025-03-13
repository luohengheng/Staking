import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  App,
  Card,
  Result,
  Popover,
  InputNumber,
  Modal,
  Spin,
} from "antd";
import styles from "./index.module.css";
import { SmileOutlined } from "@ant-design/icons";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnvironment, useWalletInfo } from "utils/customHooks";
import {
  readContract,
  readContracts,
  writeContract,
  waitForTransactionReceipt,
} from "@wagmi/core";
import { parseEther, formatEther } from "viem";
import { useBlockNumber } from "wagmi";
import { sepolia } from "wagmi/chains";
import { config } from "config";
import { PoolStakeAbi } from "abis/PoolStake";

const poolStakeAddress = "0xfC054996665AcF833456879ee29C96A4Cf7DCDff";
const IDOTokenAddress = "0x465C1876BE7b353082a61DfEBc621456815298f3";
const targetChainId = sepolia.id;
const poolStakeConfig = {
  address: poolStakeAddress as `0x${string}`,
  abi: PoolStakeAbi,
};

interface IPool {
  stTokenAddress: string; // 质押代币的地址。
  poolWeight: bigint; // 质押池的权重，影响奖励分配。
  lastRewardBlock: bigint; // 最后一次计算奖励的区块号。
  accRCCPerST: bigint; // 每个质押代币累积的 RCC 数量。
  stTokenAmount: bigint; // 池中的总质押代币量。
  minDepositAmount: bigint; // 最小质押金额。
  unstakeLockedBlocks: bigint; // 解除质押的锁定区块数。
}

interface IUser {
  stAmount: bigint; // 用户质押的代币数量。
  finishedRCC: bigint; // 已分配的 RCC 数量。
  pendingRCC: bigint; // 待领取的 RCC 数量。
  pendingWithdrawAmount?: bigint; // 已解压待提现的代币数量。
  requests?: any[]; // 解质押请求列表，每个请求包含解质押数量和解锁区块。
}

const PoolStake = () => {
  const { message } = App.useApp();
  const { isClient } = useEnvironment();
  const { balance, chainId, account } = useWalletInfo(targetChainId);
  const {
    data: blockNumber,
    isLoading,
    isError,
  } = useBlockNumber({ watch: true });
  const [poolLength, setPoolLength] = useState<bigint>(0n);
  const [poolArray, setPoolArray] = useState<IPool[]>([]);
  const [curUserInPoolInfo, setCurUserInPoolInfo] = useState<IUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPoolIndex, setModalPoolIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [unstakeAmount, setUnstakeAmount] = useState<string>("");
  const [pauseData, setPauseData] = useState<{
    withdrawPaused: boolean;
    claimPaused: boolean;
  }>({ withdrawPaused: false, claimPaused: false });

  const poolLengthFn = useCallback(async () => {
    try {
      const poolLength = (await readContract(config, {
        ...poolStakeConfig,
        functionName: "poolLength",
      })) as bigint;
      console.log("poolLength", poolLength);
      let poolDetailArray: IPool[] = [];
      if (poolLength && poolLength > 0n) {
        for (let i = BigInt(poolArray.length); i < poolLength; i++) {
          poolDetailFn(i);
        }
      }
      setPoolLength(poolLength as bigint);
    } catch (error) {
      console.log("error", error);
    }
  }, [config, poolStakeConfig]);

  const poolDetailFn = useCallback(
    async (poolIndex: bigint) => {
      const poolDetail = (await readContract(config, {
        ...poolStakeConfig,
        functionName: "pool",
        args: [poolIndex],
      })) as [string, bigint, bigint, bigint, bigint, bigint, bigint];

      console.log("poolDetail", poolDetail);
      poolArray[Number(poolIndex)] = {
        stTokenAddress: poolDetail[0],
        poolWeight: poolDetail[1],
        lastRewardBlock: poolDetail[2],
        accRCCPerST: poolDetail[3],
        stTokenAmount: poolDetail[4],
        minDepositAmount: poolDetail[5],
        unstakeLockedBlocks: poolDetail[6],
      } as IPool;
      setPoolArray([...poolArray]);
    },
    [config, poolStakeConfig, poolArray]
  );

  const userInPoolDetailFn = useCallback(
    async (poolIndex: bigint) => {
      try {
        if (!account) return;
        const userDetail = (await readContract(config, {
          ...poolStakeConfig,
          functionName: "user",
          args: [poolIndex, account],
        })) as [bigint, bigint, bigint];

        console.log("userDetail", userDetail);
        const [_, pendingWithdrawAmount] = (await readContract(config, {
          ...poolStakeConfig,
          functionName: "withdrawAmount",
          args: [poolIndex, account],
        })) as [bigint, bigint];

        curUserInPoolInfo[Number(poolIndex)] = {
          stAmount: userDetail[0],
          finishedRCC: userDetail[1],
          pendingRCC: userDetail[2],
          pendingWithdrawAmount: pendingWithdrawAmount,
        } as IUser;
        setCurUserInPoolInfo([...curUserInPoolInfo]);
      } catch (error) {
        console.log("error", error);
      }
    },
    [config, poolStakeConfig, curUserInPoolInfo, account]
  );

  const pauseStakeFn = useCallback(async () => {
    try {
      const res = (await readContracts(config, {
        contracts: [
          {
            ...poolStakeConfig,
            functionName: "withdrawPaused",
          },
          {
            ...poolStakeConfig,
            functionName: "claimPaused",
          },
        ],
      })) as { result: boolean }[];

      setPauseData({
        withdrawPaused: res[0].result,
        claimPaused: res[1].result,
      });
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  useEffect(() => {
    if (isClient && account && chainId) {
      setLoading(false);
    }
  }, [isClient, account, chainId]);

  useEffect(() => {
    if (!isClient) return;
    // 获取pool数量
    poolLengthFn();
    // 获取质押池 提现代币，领取RCC 状态
    pauseStakeFn();
  }, [isClient]);

  // 创建质押池
  const createPool = useCallback(async () => {
    try {
      //todo 如果pool数量是0，第一个池子必须是ETH
      let _stTokenAddress = "";
      if (poolLength === 0n) {
        _stTokenAddress = "0x0000000000000000000000000000000000000000";
      } else {
        _stTokenAddress = IDOTokenAddress;
      }
      let _poolWeight = 10n;
      let _minDepositAmount = 10n;
      let _unstakeLockedBlocks = (blockNumber as bigint) + 10000n;
      let _withUpdate = !(poolLength === 0n);
      const tx = await writeContract(config, {
        ...poolStakeConfig,
        functionName: "addPool",
        args: [
          _stTokenAddress as `0x${string}`,
          _poolWeight,
          _minDepositAmount,
          _unstakeLockedBlocks,
          _withUpdate,
        ],
      });
      await waitForTransactionReceipt(config, { hash: tx });
      message.success("创建质押池成功");
      // 更新池子列表
      poolLengthFn();
    } catch (error) {
      console.log("error", error);
    }
  }, [blockNumber]);

  // 质押 根据index判断是质押ETH还是质押Token, 默认第一个是ETH其他是Token
  const depositFn = useCallback(async (index: number) => {
    try {
      const tx = await writeContract(
        config,
        index === 0
          ? {
              ...poolStakeConfig,
              functionName: "depositETH",
              args: [],
              value: parseEther("0.00001"),
            }
          : {
              ...poolStakeConfig,
              functionName: "deposit",
              args: [BigInt(index), parseEther("1")],
            }
      );
      await waitForTransactionReceipt(config, { hash: tx });
      poolDetailFn(BigInt(index));
      message.success("质押成功");
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  // 解质押
  const unstakeFn = useCallback(async (index: number, amount: bigint) => {
    try {
      const tx = await writeContract(config, {
        ...poolStakeConfig,
        functionName: "unstake",
        args: [BigInt(index), amount],
      });
      await waitForTransactionReceipt(config, { hash: tx });
      poolDetailFn(BigInt(index));
      userInPoolDetailFn(BigInt(index));
      message.success("解质押成功");
      setUnstakeAmount("");
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  // 提现
  const withdrawFn = useCallback(async (index: number) => {
    try {
      const tx = await writeContract(config, {
        ...poolStakeConfig,
        functionName: "withdraw",
        args: [BigInt(index)],
      });
      await waitForTransactionReceipt(config, { hash: tx });
      poolDetailFn(BigInt(index));
      userInPoolDetailFn(BigInt(index));
      message.success("提现成功");
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  // 领取RCC
  const claimFn = useCallback(async (index: number) => {
    try {
      const tx = await writeContract(config, {
        ...poolStakeConfig,
        functionName: "claim",
        args: [BigInt(index)],
      });
      await waitForTransactionReceipt(config, { hash: tx });
      poolDetailFn(BigInt(index));
      userInPoolDetailFn(BigInt(index));
      message.success("领取成功");
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  // 开启提现
  const withdrawStatusFn = useCallback(
    async (bool: boolean) => {
      try {
        const tx = await writeContract(config, {
          ...poolStakeConfig,
          functionName: bool ? "pauseWithdraw" : "unpauseWithdraw",
          args: [],
        });
        await waitForTransactionReceipt(config, { hash: tx });
        setPauseData({
          withdrawPaused: bool,
          claimPaused: pauseData.claimPaused,
        });
        message.success(bool ? "暂停提现" : "开启提现");
      } catch (error) {
        console.log("error", error);
      }
    },
    [pauseData]
  );

  // 开启领取奖励
  const claimStatusFn = useCallback(
    async (bool: boolean) => {
      try {
        const tx = await writeContract(config, {
          ...poolStakeConfig,
          functionName: bool ? "pauseClaim" : "unpauseClaim",
          args: [],
        });
        await waitForTransactionReceipt(config, { hash: tx });
        setPauseData({
          withdrawPaused: pauseData.withdrawPaused,
          claimPaused: bool,
        });
        message.success(bool ? "暂停领取奖励" : "开启领取奖励");
      } catch (error) {
        console.log("error", error);
      }
    },
    [pauseData]
  );

  //  console.log("222", balance, chainId, account);
  return (
    <div className={styles.container}>
      <div className={styles.connectButtonClass}>
        <ConnectButton />
      </div>

      <div className={styles.title}>
        Pool Stake 当前区块({Number(blockNumber)})
        <div className={styles.btns}>
          <Button
            type={pauseData.withdrawPaused ? "dashed" : "primary"}
            onClick={() => {
              withdrawStatusFn(!pauseData.withdrawPaused);
            }}
          >
            提现 开启 / 暂停
          </Button>
          <Button
            type={pauseData.claimPaused ? "dashed" : "primary"}
            onClick={() => {
              claimStatusFn(!pauseData.claimPaused);
            }}
          >
            领取奖励 开启 / 暂停
          </Button>
          <Button type="primary" onClick={createPool}>
            Create Pool
          </Button>
        </div>
      </div>
      <div className={styles.poolList}>
        {poolLength > 0n ? (
          poolArray.map((item, index) => (
            <Card
            onClick={() => {
              userInPoolDetailFn(BigInt(index));
              setModalPoolIndex(index);
              setIsModalOpen(true);
            }}
            key={index}
            hoverable
            title={
              <div className={styles.cardTitle}>
                <span>{index === 0 ? "ETH" : `Token ${index + 1}`}</span>
                <div className={styles.cardTitleRight}>
                  <Button
                    className={styles.cardTitleBtn}
                    type="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      depositFn(index);
                    }}
                  >
                    {index === 0 ? "depositETH" : "deposit"}
                  </Button>
                </div>
              </div>
            }
            variant="borderless"
            style={{ width: 500 }}
          >
            <p className={styles.pItem}>
              <span>质押代币的地址: </span>
              {item.stTokenAddress}
            </p>
            <p className={styles.pItem}>
              <span>质押池的权重，影响奖励分配: </span>
              {Number(item.poolWeight)}
            </p>
            <p className={styles.pItem}>
              <span>最后一次计算奖励的区块号: </span>
              {Number(item.lastRewardBlock)}
            </p>
            <p className={styles.pItem}>
              <span>每个质押代币累积的 RCC 数量: </span>
              {Number(item.accRCCPerST)}
            </p>
            <p className={styles.pItem}>
              <span>池中的总质押{index === 0 ? "ETH" : "代币"}量: </span>
              {formatEther(item.stTokenAmount)} ether
            </p>
            <p className={styles.pItem}>
              <span>最小质押金额: </span>
              {Number(item.minDepositAmount)}
            </p>
            <p className={styles.pItem}>
              <span>解除质押的锁定区块数: </span>
              {Number(item.unstakeLockedBlocks)}
            </p>
          </Card>
        ))
      ) : (
        <Result
          icon={<SmileOutlined />}
          title="NO Pool!"
          extra={
            <Button type="primary" onClick={createPool}>
              Create Pool
            </Button>
          }
          />
        )}
      </div>

      <Modal
        title="用户质押详情"
        open={isModalOpen}
        footer={null}
        onCancel={() => setIsModalOpen(false)}
      >
        <div className={styles.modalContent}>
          <p className={styles.pItem}>
            <span>用户质押的代币数量: </span>
            {curUserInPoolInfo[modalPoolIndex]?.stAmount?.toString()} Token
          </p>
          <p className={styles.pItem}>
            <span>用户解压待提现的代币数量: </span>
            {curUserInPoolInfo[
              modalPoolIndex
            ]?.pendingWithdrawAmount?.toString()}{" "}
            Token
          </p>
          <p className={styles.pItem}>
            <span>已分配的 RCC 数量: </span>
            {curUserInPoolInfo[modalPoolIndex]?.finishedRCC?.toString()} RCC
          </p>
          <p className={styles.pItem}>
            <span>待领取的 RCC 数量: </span>
            {curUserInPoolInfo[modalPoolIndex]?.pendingRCC?.toString()} RCC
          </p>
          {blockNumber &&
            blockNumber >= poolArray[modalPoolIndex]?.unstakeLockedBlocks && (
              <div className={styles.inpAndBtn}>
                <InputNumber
                  disabled={curUserInPoolInfo[modalPoolIndex]?.stAmount === 0n}
                  style={{ width: 200 }}
                  min="0"
                  max={curUserInPoolInfo[modalPoolIndex]?.stAmount?.toString()}
                  status={
                    BigInt(unstakeAmount) >
                    curUserInPoolInfo[modalPoolIndex]?.stAmount
                      ? "error"
                      : ""
                  }
                  value={unstakeAmount.toString()}
                  onChange={(value) => {
                    console.log("value", value);
                    if (value) {
                      setUnstakeAmount(value);
                    }
                  }}
                />
                <Button
                  disabled={
                    BigInt(unstakeAmount) >
                      curUserInPoolInfo[modalPoolIndex]?.stAmount ||
                    curUserInPoolInfo[modalPoolIndex]?.stAmount === 0n
                  }
                  className={styles.cardTitleBtn}
                  type="primary"
                  onClick={() => {
                    unstakeFn(modalPoolIndex, BigInt(unstakeAmount));
                  }}
                >
                  unstake
                </Button>
              </div>
            )}

          <div className={styles.footerBtns}>
            <Button
              disabled={
                curUserInPoolInfo[modalPoolIndex]?.pendingWithdrawAmount ===
                  0n || pauseData.withdrawPaused
              }
              className={styles.cardTitleBtn}
              type="primary"
              onClick={() => {
                withdrawFn(modalPoolIndex);
              }}
            >
              withdraw
            </Button>

            <Button
              disabled={
                curUserInPoolInfo[modalPoolIndex]?.pendingRCC === 0n ||
                pauseData.claimPaused
              }
              className={styles.cardTitleBtn}
              type="primary"
              onClick={() => {
                claimFn(modalPoolIndex);
              }}
            >
              claim
            </Button>
          </div>
        </div>
      </Modal>

      <Spin spinning={loading} fullscreen />
    </div>
  );
};

export default PoolStake;
