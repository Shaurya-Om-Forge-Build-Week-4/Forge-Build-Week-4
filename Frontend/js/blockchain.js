import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";
import { VOTING_ADDRESS, TREASURY_ADDRESS } from "./config.js";
import votingABI from "./VotingABI.js";
import treasuryABI from "./TreasuryABI.js";


export async function getContracts() {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  return {
    voting: new ethers.Contract(VOTING_ADDRESS, votingABI, signer),
    treasury: new ethers.Contract(TREASURY_ADDRESS, treasuryABI, signer),
    signer
  };
}
