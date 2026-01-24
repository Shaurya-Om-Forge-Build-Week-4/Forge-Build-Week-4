import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { TREASURY_ADDRESS, VOTING_ADDRESS } from "./config.js";
import votingABI from "./VotingABI.js";
import treasuryABI from "./TreasuryABI.js";

export async function getVotingContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  console.log(signer)

  return new ethers.Contract(VOTING_ADDRESS, votingABI, signer);
}

export async function getTreasuryContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  console.log(signer)

  return new ethers.Contract(TREASURY_ADDRESS, treasuryABI, signer);
}
