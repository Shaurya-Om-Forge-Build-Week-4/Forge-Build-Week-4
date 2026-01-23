import { getContracts } from "../js/blockchain.js";
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";



console.log("signup.js loaded");

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is required");
  }
  
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;
  
  const form = document.getElementById("signup-form");
  const message = document.getElementById("message");
  
  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const full_name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const locality = document.getElementById("locality").value;

    if (!full_name || !email || !password || !locality) {
      throw new Error("All fields are required");
    }

    message.textContent = "Creating account...";

    // 1️⃣ Supabase signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error("Signup failed");

    // 2️⃣ Connect wallet
    message.textContent = "Connecting wallet...";
    const { voting, signer } = await getContracts();
    const walletAddress = await signer.getAddress();

    // 3️⃣ REGISTER USER ON-CHAIN  🚨🚨🚨
    message.textContent = "Registering on blockchain...";
    const tx = await voting.registerUser(walletAddress, Number(locality));
    await tx.wait();

    // 4️⃣ Store profile in Supabase
    const userType = document.querySelector(
      'input[name="user_type"]:checked'
    ).value;

    const isContractor = userType === "contractor";

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name,
        locality,
        credits: 100,              // mirror blockchain
        isContractor
      });

    if (profileError) throw profileError;

    message.textContent = "Signup successful!";
    message.style.color = "green";

    setTimeout(() => {
      window.location.href = "../html/index.html";
    }, 1000);

  } catch (err) {
    console.error(err);
    message.textContent = err.message || "Signup failed";
    message.style.color = "red";
  }
});
});
