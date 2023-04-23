const fs = require("fs")
const { network } = require("hardhat")

const frontEndContractsFile =
    "../front-end-insurance-smartcontract-nextjs-project/constants/contractAddresses.json"
const frontEndAbiFile =
    "../front-end-insurance-smartcontract-nextjs-project/constants/abi.json"

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Writing to front end...")
        await updateContractAddresses()
        await updateAbi()
        console.log("Front end written!")
    }
}

async function updateAbi() {
    const insu = await ethers.getContract("Insu")
    fs.writeFileSync(
        frontEndAbiFile,
        insu.interface.format(ethers.utils.FormatTypes.json)
    )
}

async function updateContractAddresses() {
    const insu = await ethers.getContract("Insu")
    const contractAddresses = JSON.parse(
        fs.readFileSync(frontEndContractsFile, "utf8")
    )
    if (network.config.chainId.toString() in contractAddresses) {
        if (
            !contractAddresses[network.config.chainId.toString()].includes(
                insu.address
            )
        ) {
            contractAddresses[network.config.chainId.toString()].push(
                insu.address
            )
        }
    } else {
        contractAddresses[network.config.chainId.toString()] = [insu.address]
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
}
module.exports.tags = ["all", "frontend"]
