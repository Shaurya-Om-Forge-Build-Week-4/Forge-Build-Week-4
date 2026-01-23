import { getContracts } from "./blockchain.js";
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";

export async function sendFunds(contractorWallet, amountEth) {
  const { treasury } = await getContracts();
  const tx = await treasury.pay(
    contractorWallet,
    ethers.utils.parseEther(amountEth)
  );
  await tx.wait();
}
