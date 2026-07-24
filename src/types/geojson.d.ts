declare module "*.geojson" {
  const value: unknown;
  export default value;
}

declare module "*.geojson?raw" {
  const value: string;
  export default value;
}

declare module "*.css?raw" {
  const value: string;
  export default value;
}
