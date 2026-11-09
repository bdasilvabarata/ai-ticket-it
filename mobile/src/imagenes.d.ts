// Metro resuelve un `import` de imagen a un recurso que acepta `<Image source>`.
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";

  const imagen: ImageSourcePropType;
  export default imagen;
}
