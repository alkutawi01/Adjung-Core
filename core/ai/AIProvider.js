class AIProvider {
  constructor(apiKey, modelName) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generate(promptText, systemInstructions = '', searchTools = null) {
    throw new Error("Method 'generate()' must be implemented.");
  }
}

export default AIProvider;
