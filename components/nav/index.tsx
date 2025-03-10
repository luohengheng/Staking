import styles from "./index.module.css";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function NavBar() {
  return (
    <div className={styles.nav}>
      <div className={styles.nav_left}>
        <Link href="/eth-staking">
          <Button className={styles.btn}>原生代币质押</Button>
        </Link>
        <Link href="/erc20-staking">
          <Button className={styles.btn}>ERC20代币质押</Button>
        </Link>
      </div>

      <ConnectButton />
    </div>
  );
}
