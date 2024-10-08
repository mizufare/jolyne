module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    env: {
        node: true,
    },
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    rules: {
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/ban-ts-comment": "error",
        "@typescript-eslint/no-empty-function": "off",
        "no-mixed-spaces-and-tabs": ["warn", "smart-tabs"],
        "no-empty": "off",
        semi: "error",
    },
};
