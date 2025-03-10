import { useState, useEffect, useCallback } from "react";
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
} from "@wagmi/core";
import { MKNFT, NFTStakingABI, ERC20StakingABI, ERC20ABI } from "@/abis/NFTABI";
import { config } from "@/config";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import moment from "moment";
import { message, Spin, Modal, Input, Button } from "antd";

//todo bsc testnet网络
const ERC20StakingContractAddress =
  "0x1aF4b4C6B647380f421c2be8c6334E65Bcfd02EB";
const GistTokenAddress = "0x0bb8A795d9dDC39a6E74c78423b7cf5186CD37e7";
const NFTStaking = "0xba2F577149b1a8fb9AFE37FCA8ADbBAA6693e731";
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

type StakeData = [string, bigint, bigint, bigint, boolean];

const ERC20Staking = () => {
  const { isClient } = useEnvironment();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const [stakeData, setStakeData] = useState<StakeData | null>();
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState<bigint>(0n);
  const [balanceOfAmount, setBalanceOfAmount] = useState<bigint>(0n);

  // 查看该用户GIST数量
  const getBalanceOfAmount = useCallback(async () => {
    const balanceOfAmount = await readContract(config, {
      address: GistTokenAddress as `0x${string}`,
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: [address],
    });
    setBalanceOfAmount(balanceOfAmount as bigint);
  }, [address]);

  // 查看质押信息
  const checkStake = useCallback(async () => {
    try {
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
  }, [address]);

  useEffect(() => {
    if (!isClient) return;
    if (isClient && !isConnected && connect) {
      connect({ connector: injected() });
    }
    if (isClient && isConnected) {
      checkStake();
      getBalanceOfAmount();
    }
  }, [isClient, isConnected, connect, checkStake, getBalanceOfAmount]);

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

  // console.log("balanceOfAmount", balanceOfAmount, amount);
  if (!isClient) return null;
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
          {stakeData && (
            <Erc20StakeComponent
              stakeData={stakeData}
              setLoading={setLoading}
              checkStake={checkStake}
              setIsModalOpen={setIsModalOpen}
            />
          )}
          {address && isConnected && (
            <NFTStakeComponent address={address} isConnected={isConnected} />
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
    </Spin>
  );
};

ERC20Staking.isShowNav = true;
export default ERC20Staking;

interface IErc20StakeCompProps {
  stakeData: StakeData;
  setLoading: (loading: boolean) => void;
  checkStake: () => void;
  setIsModalOpen: (isModalOpen: boolean) => void;
}

const Erc20StakeComponent = ({
  stakeData,
  setLoading,
  checkStake,
  setIsModalOpen,
}: IErc20StakeCompProps) => {
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
      setLoading(true);
      const claimRewardsHash = await writeContract(config, {
        ...stakingContractConfig,
        functionName: "claimReward",
        args: [],
      });
      await waitForTransactionReceipt(config, { hash: claimRewardsHash });
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <Card className={styles.stakingCard}>
      <div className={styles.tokenInfo}>
        <img
          src={gist.src}
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
  );
};

interface INFTStakeCompProps {
  address: string;
  isConnected: boolean;
}

const NFTStakeComponent = ({ address, isConnected }: INFTStakeCompProps) => {
  const { isClient } = useEnvironment();
  const [nftBalance, setNFTBalance] = useState<bigint>(0n);

  const getNFTBalance = useCallback(async () => {
    if (!address) return;
    try {
      const balance = await readContract(config, {
        ...nftContractConfig,
        functionName: "balanceOf",
        args: [address],
      });
      setNFTBalance(balance as bigint);
      console.log("balance111", balance);

      const getNFTBalanceHash = await writeContract(config, {
        ...nftContractConfig,
        functionName: "getTokensByOwner",
        args: [address],
      });
      await waitForTransactionReceipt(config, { hash: getNFTBalanceHash });
    } catch (error) {
      console.error(error);
    }
  }, [address]);

  useEffect(() => {
    if (!isClient || !isConnected) return;
    getNFTBalance();
  }, [isClient, getNFTBalance, isConnected]);

  if (!isClient) return null;
  if (nftBalance === 0n) return null;
  return (
    <Card className={styles.stakingCard}>
      <div className={styles.tokenInfo}>
        <img
          src={gist.src}
          alt="NFT"
          className={styles.tokenIcon}
          width={32}
          height={32}
        />
        <span className={styles.tokenLabel}>NFT</span>
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

        {/* {stakeData && stakeData[1] > BigInt(0) ? (
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
        )} */}
      </div>
    </Card>
  );
};
