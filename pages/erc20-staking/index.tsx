import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "./index.module.css";
import gist from "@/assets/images/icon_gist.png";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useEnvironment } from "@/utils/customHooks";
import { formatEther, parseEther } from "viem";
import {
  writeContract,
  waitForTransactionReceipt,
  readContract,
  switchChain,
} from "@wagmi/core";
import { MKNFT, NFTStakingABI, ERC20StakingABI, ERC20ABI } from "@/abis/NFTABI";
import { config } from "@/config";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import moment from "moment";
import { Spin, Modal, Input, Button, App } from "antd";
import axios from "axios";
import { bscTestnet } from "wagmi/chains";

//todo bsc testnet网络
const ERC20StakingContractAddress =
  "0x1aF4b4C6B647380f421c2be8c6334E65Bcfd02EB";
const GistTokenAddress = "0x0bb8A795d9dDC39a6E74c78423b7cf5186CD37e7";
const NFTStakingContractAddress = "0xba2F577149b1a8fb9AFE37FCA8ADbBAA6693e731";
const MkNFTAddress = "0x5E11f3B4CAa22095fAE861f8C35fee02d8C49724";

const stakingData = {
  totalStaked: "20,250K",
  totalRewards: "415.71K",
  stakingRewards: "415.71K",
};

const stakingContractConfig = {
  address: ERC20StakingContractAddress as `0x${string}`,
  abi: ERC20StakingABI,
};

const nftContractConfig = {
  address: MkNFTAddress as `0x${string}`,
  abi: MKNFT,
};

const nftStakingContractConfig = {
  address: NFTStakingContractAddress as `0x${string}`,
  abi: NFTStakingABI,
};

type StakeData = [string, bigint, bigint, bigint, boolean];

const ERC20Staking = () => {
  const { message } = App.useApp();
  const { isClient } = useEnvironment();
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const [loading, setLoading] = useState(false);
  const [isFresh, setIsFresh] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    if (isClient && !isConnected && connect) {
      connect({ connector: injected() });
    }
    if (isClient && chain?.id !== bscTestnet.id) {
      message.error("请切换到BSC测试网络");
      switchChain(config, { chainId: bscTestnet.id }).then(() => {
        message.success("已切换到BSC测试网络");
      });
    }
  }, [
    isClient,
    isConnected,
    connect,
    message,
    chain?.id,
  ]);

  // console.log("balanceOfAmount", balanceOfAmount, amount);
  if (!isClient || chain?.id !== bscTestnet.id) return null;
  return (
    <Spin tip="Loading..." spinning={loading}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>TOKEN STAKING</h1>
          <div className={styles.subHeader}>
            <span>DEPOSIT & EARN GIST</span>
            <a href="#">HOW TO GET GIST?</a>
          </div>
        </div>

        <div className={styles.statsContainer}>
          <div className={styles.statItem}>
            <span>TOTAL STAKED</span>
            <span>{stakingData.totalStaked}</span>
          </div>
          <div className={styles.statItem}>
            <span>TOTAL REWARDS</span>
            <span>{stakingData.totalRewards}</span>
          </div>
          <div className={styles.statItem}>
            <span>STAKING REWARDS</span>
            <span>{stakingData.stakingRewards}</span>
          </div>
        </div>

        <Tabs defaultValue="IN_PROGRESS">
          <TabsList className="grid w-full grid-cols-3 mb-10 h-13">
            <TabsTrigger value="IN_PROGRESS" className={styles.tabButton}>
              <div className={styles.statItem}>IN PROGRESS</div>
            </TabsTrigger>
            <TabsTrigger value="MY_PARTICIPATION" className={styles.tabButton}>
              <div className={styles.statItem}>MY PARTICIPATION</div>
            </TabsTrigger>
            <TabsTrigger value="PAST_STAKING" className={styles.tabButton}>
              <div className={styles.statItem}>PAST STAKING</div>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className={styles.cardsContainer}>
          {address && isConnected && (
            <Erc20StakeComponent
              setLoading={setLoading}
              message={message}
              address={address}
              chain={chain}
              isClient={isClient}
              isConnected={isConnected}
              setIsFresh={setIsFresh}
              isFresh={isFresh}
            />
          )}
          {address && isConnected && (
            <NFTStakeComponent
              address={address}
              isConnected={isConnected}
              setLoading={setLoading}
              isFresh={isFresh}
            />
          )}
        </div>

        <div className={styles.faqSection}>
          <h2>FAQ</h2>
          <div className={styles.faqItem}>
            <h3>HOW TO PARTICIPATE IN THE AUCTION?</h3>
            <p>
              USERS MUST TO JOIN TELEGRAM ACCOUNT, AND PREPARE SUFFICIENT
              BIDDING FUNDS BEFOREHAND. DURING THE AUCTION, USERS CAN BID
              MULTIPLE TIMES BASED ON THE LEADERBOARD STATUS.
            </p>
          </div>
        </div>
      </div>
    </Spin>
  );
};

ERC20Staking.isShowNav = true;
export default ERC20Staking;

interface IErc20StakeCompProps {
  setLoading: (loading: boolean) => void;
  message: any;
  address: string;
  chain: any;
  isClient: boolean;
  isConnected: boolean;
  setIsFresh: (isFresh: number) => void;
  isFresh: number;
}

const Erc20StakeComponent = ({
  setLoading,
  message,
  address,
  chain,
  isClient,
  isConnected,
  setIsFresh,
  isFresh
}: IErc20StakeCompProps) => {
  const [amount, setAmount] = useState<bigint>(0n);
  const [balanceOfAmount, setBalanceOfAmount] = useState<bigint>(0n);
  const [stakeData, setStakeData] = useState<StakeData | null>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 查看该用户GIST数量
  const getBalanceOfAmount = useCallback(async () => {
    if (chain?.id !== bscTestnet.id) return;
    const balanceOfAmount = await readContract(config, {
      address: GistTokenAddress as `0x${string}`,
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: [address],
    });
    setBalanceOfAmount(balanceOfAmount as bigint);
  }, [address, chain?.id]);

  // 查看质押信息
  const checkStake = useCallback(async () => {
    try {
      if (chain?.id !== bscTestnet.id) return;
      const stakeData = await readContract(config, {
        ...stakingContractConfig,
        functionName: "stakes",
        args: [address],
      });
      console.log(stakeData);
      setStakeData(stakeData as StakeData);
    } catch (error) {
      console.error(error);
    }
  }, [address, chain?.id]);

  // 代币解质押
  const erc20Unstake = async () => {
    try {
      // 判断质押时间是否结束
      const isBefore = moment().isBefore(moment(Number(stakeData?.[2])));
      if (isBefore) {
        message.error("质押时间未结束");
        return;
      }
      setLoading(true);
      const unstakeHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "unstake",
        args: [],
      });
      await waitForTransactionReceipt(config, { hash: unstakeHash });
      setLoading(false);
      checkStake();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  // 领取质押奖励
  const erc20ClaimRewards = async () => {
    try {
      // 判断质押时间是否结束
      const isBefore = moment().isBefore(moment(Number(stakeData?.[2])));
      if (isBefore) {
        message.error("质押时间未结束");
        return;
      }
      setLoading(true);
      const claimRewardsHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "claimReward",
        args: [],
      });
      await waitForTransactionReceipt(config, { hash: claimRewardsHash });
      setIsFresh(isFresh + 1);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

   // 代币质押
   const erc20Stake = async (amount: bigint, duration: number = 1) => {
    try {
      const allowanceAmount = await readContract(config, {
        address: GistTokenAddress as `0x${string}`,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [address, ERC20StakingContractAddress],
      });

      console.log("allowanceAmount", allowanceAmount, balanceOfAmount);
      if ((allowanceAmount as bigint) < amount) {
        message.error("授权代币数量小于质押数量");
        setLoading(true);
        const approveHash = await writeContract(config, {
          address: GistTokenAddress as `0x${string}`,
          abi: ERC20ABI,
          functionName: "approve",
          args: [ERC20StakingContractAddress, balanceOfAmount],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }
      if ((balanceOfAmount as bigint) < amount) {
        message.error("质押数量大于代币余额");
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log("stake");
      const stakeHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "stake",
        args: [amount, duration],
      });
      await waitForTransactionReceipt(config, { hash: stakeHash });
      setLoading(false);
      checkStake();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isClient) return;
    if (isClient && isConnected) {
      checkStake();
      getBalanceOfAmount();
    }
  }, [isClient, isConnected, checkStake, getBalanceOfAmount]);

  return (
    <>
      <Card className={styles.stakingCard}>
        <div className={styles.tokenInfo}>
          <img
            src='/images/icon_gist.png'
            alt="GIST"
            className={styles.tokenIcon}
            width={32}
            height={32}
          />
          <span className={styles.tokenLabel}>GIST</span>
          <span className={styles.flexibleTag}>FLEXIBLE</span>
        </div>

        <div className={styles.stakingDetails}>
          <div className={styles.detailRow}>
            <span>STAKING AMOUNT</span>
            <span>1222.50H</span>
          </div>
          <div className={styles.detailRow}>
            <span>APY</span>
            <span>14.5%</span>
          </div>
          <div className={styles.detailRow}>
            <span>EARNING REWARDS</span>
            <span>744.96</span>
          </div>

          <div className={styles.dateRange}>
            <div>FROM: 2025-01-01 12:23:56</div>
            <div>TO: 2025-12-01 12:23:56</div>
          </div>

          {stakeData && stakeData[1] > BigInt(0) ? (
            <>
              <button
                className={`${styles.stakingButton}`}
                onClick={erc20Unstake}
              >
                UNSTAKE
              </button>
              {!stakeData[4] && (
                <button
                  className={`${styles.stakingButton}`}
                  onClick={erc20ClaimRewards}
                >
                  CLAIM REWARDS
                </button>
              )}
            </>
          ) : (
            <button
              className={styles.stakingButton}
              onClick={() => setIsModalOpen(true)}
            >
              STAKE
            </button>
          )}
        </div>
      </Card>

      <Modal
        title="STAKE GIST"
        open={isModalOpen}
        footer={null}
        onCancel={() => {
          setIsModalOpen(false);
          setAmount(0n);
        }}
      >
        <Input
          type="number"
          suffix="max"
          min={0}
          status={balanceOfAmount < amount ? "error" : ""}
          placeholder="please input amount"
          value={amount}
          onChange={(e) => setAmount(BigInt(e.target.value))}
        />
        <Button
          type="primary"
          disabled={balanceOfAmount < amount}
          className={styles.stakingModalButton}
          onClick={() => {
            setIsModalOpen(false);
            setAmount(0n);
            erc20Stake(amount, 1);
          }}
        >
          ENTER AMOUNT
        </Button>
      </Modal>
    </>
  );
};

interface INFTStakeCompProps {
  address: string;
  isConnected: boolean;
  setLoading: (loading: boolean) => void;
  isFresh: number;
}

type NFTStakingType = [string, bigint, bigint, bigint, boolean];

const NFTStakeComponent = ({
  address,
  isConnected,
  setLoading,
  isFresh
}: INFTStakeCompProps) => {
  const { message } = App.useApp();
  const { isClient } = useEnvironment();
  const [nftBalance, setNFTBalance] = useState<bigint[]>([]);
  const [nftStakingInfo, setNFTStakingInfo] = useState<NFTStakingType | null>();

  const getNFTInfo = useCallback(async () => {
    if (!address) return;
    try {
      // 查询质押信息
      const NFTStakingInfo = await readContract(config, {
        ...nftStakingContractConfig,
        functionName: "stakes",
        args: [address],
      });
      console.log("NFTStakingInfo", NFTStakingInfo);
      setNFTStakingInfo(NFTStakingInfo as NFTStakingType);

      // 区块信息，需要手动过滤txid
      const res = await axios.get(
        "https://api-testnet.bscscan.com/api?module=account&action=tokennfttx&address=0x7C626854EC31309Ad7f130E9762670507E94D1D1&apikey=CVER3JRFE4NGFGQWZ1NR5877STX1PSKTCX"
      );
      let arr = Array.from(
        new Set(res.data.result.map((item: any) => BigInt(item.tokenID)))
      );
      console.log("arr", arr);
      setNFTBalance(arr as bigint[]);
    } catch (error) {
      console.error(error);
    }
  }, [address]);

  useEffect(() => {
    if (!isClient || !isConnected) return;
    getNFTInfo();
  }, [isClient, getNFTInfo, isConnected, isFresh]);

  const NFTStaking = useCallback(
    async (tokenId: bigint, duration: number = 1) => {
      try {
        // 判断当前是否存在质押，如果存在停止后续操作
        if (nftStakingInfo && nftStakingInfo[1] > BigInt(0)) {
          message.warning("NFT存在已质押，请先解质押");
          return;
        }

        setLoading(true);
        // 查询是否授权
        const allowanceAmount = await readContract(config, {
          address: MkNFTAddress as `0x${string}`,
          abi: MKNFT,
          functionName: "getApproved",
          args: [tokenId],
        });
        console.log("allowanceAmount", allowanceAmount);
        if (allowanceAmount === "0x0000000000000000000000000000000000000000") {
          message.warning("未授权，请求授权");
          const approveHash = await writeContract(config, {
            address: MkNFTAddress as `0x${string}`,
            abi: MKNFT,
            functionName: "approve",
            args: [NFTStakingContractAddress, tokenId],
          });
          await waitForTransactionReceipt(config, { hash: approveHash });
          message.success("授权成功");
        }

        const stakeHash = await writeContract(config, {
          ...nftStakingContractConfig,
          functionName: "stake",
          args: [tokenId, duration],
        });
        await waitForTransactionReceipt(config, { hash: stakeHash });
        getNFTInfo();
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    },
    [getNFTInfo, setLoading, message, nftStakingInfo]
  );

  const NFTUnstake = useCallback(async () => {
    try {
      // 判断质押时间是否结束
      const isBefore = moment().isBefore(moment(Number(nftStakingInfo?.[3])));
      if (isBefore) {
        message.error("质押时间未结束");
        return;
      }

      setLoading(true);
      const unstakeHash = await writeContract(config, {
        ...nftStakingContractConfig,
        functionName: "unstake",
        args: [],
      });
      await waitForTransactionReceipt(config, { hash: unstakeHash });
      getNFTInfo();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }, [getNFTInfo, setLoading, nftStakingInfo, message]);

  const NFTClaimRewards = useCallback(async () => {
    try {
      // 判断质押时间是否结束
      const isBefore = moment().isBefore(moment(Number(nftStakingInfo?.[3])));
      if (isBefore) {
        message.error("质押时间未结束");
        return;
      }

      setLoading(true);
      const claimRewardsHash = await writeContract(config, {
        ...nftStakingContractConfig,
        functionName: "claimReward",
        args: [],
      });
      await waitForTransactionReceipt(config, { hash: claimRewardsHash });
      getNFTInfo();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }, [getNFTInfo, setLoading, nftStakingInfo, message]);

  if (!isClient) return null;
  if (nftBalance.length === 0) return null;
  return nftBalance.map((i, index) => (
    <Card className={styles.stakingCard} key={index}>
      <div className={styles.tokenInfo}>
        <img
          src='/images/icon_gist.png'
          alt="NFT"
          className={styles.tokenIcon}
          width={32}
          height={32}
        />
        <span className={styles.tokenLabel}>NFT{index + 1}</span>
        <span className={styles.flexibleTag}>FLEXIBLE</span>
      </div>
      <div className={styles.stakingDetails}>
        <div className={styles.detailRow}>
          <span>STAKING AMOUNT</span>
          <span>1222.50H</span>
        </div>
        <div className={styles.detailRow}>
          <span>APY</span>
          <span>14.5%</span>
        </div>
        <div className={styles.detailRow}>
          <span>EARNING REWARDS</span>
          <span>744.96</span>
        </div>

        <div className={styles.dateRange}>
          <div>FROM: 2025-01-01 12:23:56</div>
          <div>TO: 2025-12-01 12:23:56</div>
        </div>

        {nftStakingInfo && nftStakingInfo[1] === i ? (
          <>
            <button className={`${styles.stakingButton}`} onClick={NFTUnstake}>
              UNSTAKE
            </button>
            {!nftStakingInfo[4] && (
              <button
                className={`${styles.stakingButton}`}
                onClick={NFTClaimRewards}
              >
                CLAIM REWARDS
              </button>
            )}
          </>
        ) : (
          <button
            className={styles.stakingButton}
            onClick={() => NFTStaking(i, 1)}
          >
            STAKE
          </button>
        )}
      </div>
    </Card>
  ));
};
