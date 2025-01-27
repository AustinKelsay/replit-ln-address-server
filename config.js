const config = {
    users: {
        // Each user can have their own configuration
        austin: {
            metadata: [["text/plain", "Austin's Lightning Address Endpoint"]],
            maxSendable: 1000000, // millisatoshis
            minSendable: 1000, // millisatoshis
            // You could add more user-specific configurations here
            // For example:
            // customDescription: "My Lightning Address",
            // allowedAmounts: [1000, 5000, 10000],
            // etc.
        },
        // Add more users as needed:
        // satoshi: {
        //     metadata: [["text/plain", "Satoshi's Lightning Address"]],
        //     maxSendable: 100000000,
        //     minSendable: 1000
        // }
    },
    // Global configuration
    defaultMetadata: [["text/plain", "Lightning Address Payment"]],
    defaultMaxSendable: 1000000,
    defaultMinSendable: 1000,
};

module.exports = config;
