// Import required dependencies
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const { bech32 } = require("bech32");

// Import our user configurations
const config = require("./config");

// Initialize Express application
const app = express();
const port = process.env.PORT || 3000;

// Middleware Setup
app.use(cors());
app.use(express.json());

// Lightning Network Daemon (LND) configuration
// These values should be in your .env file
const lndConfig = {
    host: process.env.LND_HOST,
    macaroon: process.env.LND_MACAROON,
};

// Helper function to encode URLs into LNURL format
// LNURL is a bech32-encoded URL that represents Lightning Network operations
function encodeLnurl(url) {
    const words = bech32.toWords(Buffer.from(url, "utf8"));
    return bech32.encode("lnurl", words, 2000).toUpperCase();
}

// Helper function to retrieve user configuration from our config file
// Returns null if user doesn't exist
function getUserConfig(username) {
    return config.users[username] || null;
}

// Lightning Address endpoint handler
// This endpoint follows the LUD-16 spec for Lightning Addresses
// Format: username@domain becomes domain/.well-known/lnurlp/username
app.get("/.well-known/lnurlp/:username", (req, res) => {
    const { username } = req.params;

    // Basic validation
    if (!username || username === "undefined") {
        return res.status(404).json({ error: "Not found" });
    }

    // Check if user exists in our config
    const userConfig = getUserConfig(username);
    if (!userConfig) {
        return res.status(404).json({ error: "Username not found" });
    }

    // Return LNURL-pay parameters according to spec
    return res.status(200).json({
        callback: `${process.env.BACKEND_URL}/api/callback/${username}`, // URL that will create the invoice
        maxSendable: userConfig.maxSendable || config.defaultMaxSendable, // Maximum amount in millisatoshis
        minSendable: userConfig.minSendable || config.defaultMinSendable, // Minimum amount in millisatoshis
        metadata: JSON.stringify(userConfig.metadata || config.defaultMetadata), // Payment metadata
        tag: "payRequest", // Identifies this as a payment request
    });
});

// Callback endpoint that generates the actual Lightning invoice
app.get("/api/callback/:username", async (req, res) => {
    const { username } = req.params;
    const { amount } = req.query; // Amount in millisatoshis

    // Validate user exists
    const userConfig = getUserConfig(username);
    if (!userConfig) {
        return res.status(404).json({ error: "Username not found" });
    }

    // Ensure amount was provided
    if (!amount) {
        return res.status(400).json({ error: "Amount not specified" });
    }

    // Prepare invoice metadata
    const metadata = userConfig.metadata || config.defaultMetadata;
    const metadataString = JSON.stringify(metadata);
    // Create a hash of the metadata for the invoice
    const hash = crypto
        .createHash("sha256")
        .update(metadataString)
        .digest("hex");
    const descriptionHash = Buffer.from(hash, "hex").toString("base64");

    // Convert amount from millisatoshis to satoshis (LND uses satoshis)
    const value = parseInt(amount) / 1000;

    if (value < 1) {
        return res.status(400).json({ error: "Amount too low" });
    }

    try {
        // Create an invoice using LND's REST API
        const response = await axios.post(
            `${lndConfig.host}:8080/v1/invoices`,
            {
                value: value,
                description_hash: descriptionHash, // Hash of the metadata
            },
            {
                headers: {
                    "Grpc-Metadata-macaroon": lndConfig.macaroon, // Authentication
                },
            },
        );

        // Return the payment request (invoice)
        res.status(200).json({ pr: response.data.payment_request });
    } catch (error) {
        console.error("Error creating invoice:", error.message);
        res.status(500).json({ error: "Failed to create invoice" });
    }
});

// Utility endpoint to get LNURL for a username
// This is helpful for testing and displaying the LNURL
app.get("/api/getLnurl/:username", (req, res) => {
    const { username } = req.params;

    if (!getUserConfig(username)) {
        return res.status(404).json({ error: "Username not found" });
    }

    // Create and encode the Lightning Address URL
    const originalUrl = `${process.env.BACKEND_URL}/.well-known/lnurlp/${username}`;
    const encodedLnurl = encodeLnurl(originalUrl);
    res.status(200).json({ lnurl: encodedLnurl });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Lightning Address server running on port ${port}`);
});
