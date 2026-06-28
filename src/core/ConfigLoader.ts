type ConfigMap = Record<string, any>;

class ConfigLoader {
  private configs = new Map<string, ConfigMap>();

  async load(name: string): Promise<ConfigMap> {
    if (this.configs.has(name)) {
      return this.configs.get(name)!;
    }
    const module = await import(`../config/${name}.json`);
    this.configs.set(name, module.default ?? module);
    return this.configs.get(name)!;
  }

  loadSync(name: string, data: ConfigMap) {
    this.configs.set(name, data);
  }

  get<T = ConfigMap>(name: string): T {
    const c = this.configs.get(name);
    if (!c) throw new Error(`Config "${name}" not loaded`);
    return c as unknown as T;
  }
}

export const configLoader = new ConfigLoader();
