const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const { developmentChains } = require("../helper-hardhat-config")

// async function main() {
//     const Insu = await ethers.getContractFactory("Insu")
//     const insu = await Insu.deploy()

//     console.log("Insu contract deployed to:", insu.address)

//     if (
//         !developmentChains.includes(network.name) &&
//         process.env.ETHERSCAN_API_KEY
//     ) {
//         //VERIFY
//         await verify(insu.address)
//     }

//     console.log("------------------------------------")
// }

// main().catch((error) => {
//     console.error(error)
//     process.exitCode = 1
// })
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    //const chainId = network.config.chainId

    const insu = await deploy("Insu", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        //VERIFY
        await verify(insu.address)
    }

    log("------------------------------------")
}

module.exports.tags = ["all", "insu"]
