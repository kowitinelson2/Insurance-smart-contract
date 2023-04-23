const { ethers } = require("hardhat")
const networkConfig = {
    default: {
        name: "hardhat",
    },
    11155111: {
        name: "sepolia",
    },
    31337: {
        name: "localhost",
    },
}
const developmentChains = ["hardhat", "localhost"]
module.exports = {
    networkConfig,
    developmentChains,
}
