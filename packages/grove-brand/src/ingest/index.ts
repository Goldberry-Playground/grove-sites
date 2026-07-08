export {
  KNOWN_BRANDS,
  KNOWN_CLASSES,
  LOGO_CLASS,
  isKnownBrand,
  isKnownClass,
  isLogoClass,
  type Brand,
  type AssetClass,
} from "./taxonomy";

export {
  registryPath,
  emptyRegistry,
  upsertBrandEntry,
  renderRegistry,
  parseRegistry,
  type BrandEntry,
  type BrandAssetRegistry,
  type UpsertKind,
  type UpsertResult,
} from "./model";

export {
  createAssetBrand,
  type AssetBrand,
  type ProposeBrandEntryInput,
  type BrandRepo,
  type PullRequestOpener,
  type CreateAssetBrandDeps,
} from "./asset-brand";
