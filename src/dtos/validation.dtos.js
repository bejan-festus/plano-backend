import joi from 'joi';

export const createBuilderSchema = joi.object( {
  storeName: joi.string().required(),
  storeId: joi.string().required(),
  clientId: joi.string().required(),
  floorNumber: joi.number().required(),
} );

export const createBuilder = {
  body: createBuilderSchema,
};

export const updateStoreLayoutSchema = joi.object( {
  id: joi.string().required(),
  layoutPolygon: joi.array().required(),
  status: joi.string().required(),
} );

export const updateStoreLayout = {
  body: updateStoreLayoutSchema,
};

export const storeLayoutListSchema = joi.object( {
  limit: joi.number().required(),
  offset: joi.number().required(),
  filter: joi.array().items( joi.any() ).min( 0 ),
  searchValue: joi.string().required().allow( '' ),
  sortColumnName: joi.string().required().allow( '' ),
  sortBy: joi.number().required().allow( '' ),
  clientId: joi.string().required(),
} );

export const storeLayoutList ={
  body: storeLayoutListSchema,
};

export const updateFloorSchema = joi.object( {
  id: joi.string().required(),
  floorNumber: joi.number().required(),
} );

export const updateFloor = {
  body: updateFloorSchema,
};

export const storeListSchema = joi.object( {
  id: joi.array().items( joi.any() ).min( 1 ).required(),
} );

export const storeList = {
  body: storeListSchema,
};

export const fixtureShelfProductSchema = joi.object( {
  fixtureId: joi.string().required(),
  floorId: joi.string().required(),
  planoId: joi.string().required(),
} );

export const fixtureShelfProduct = {
  body: fixtureShelfProductSchema,
};

export const storeDetailSchema = joi.object( {
  storeId: joi.string().required(),
  clientId: joi.string().required(),
} );

export const storeDetails = {
  body: storeDetailSchema,
};

export const deleteStoreLayoutSchema = joi.object( {
  id: joi.string().required(),
} );


export const deleteStoreLayout = {
  params: deleteStoreLayoutSchema,
};

export const updateStatusSchema = joi.object( {
  storeId: joi.array().required(),
  status: joi.string().required(),
} );

export const updateStatus = {
  body: updateStatusSchema,
};

export const createFixtureSchema = joi.object( {
  fixtureCategory: joi.string().required(),
  fixtureType: joi.string().required(),
  clientId: joi.string().required(),
} );

export const createFixture = {
  body: createFixtureSchema,
};

export const updateFixtureSchema = joi.object( {
  fixtureWidth: joi.object().optional(),
  fixtureHeight: joi.object().optional(),
  fixtureCategory: joi.string().optional(),
  fixtureLength: joi.object().optional(),
  header: joi.object().optional(),
  footer: joi.object().optional(),
  shelfConfig: joi.array().optional(),
  status: joi.string().required(),
  fixtureCapacity: joi.number().required(),
  isBodyEnabled: joi.boolean().required(),
} );

export const fixtureIdSchema = joi.object( {
  fixtureId: joi.string().required(),
} );

export const fixtureId ={
  query: fixtureIdSchema,
};

export const bodyFixtureId = {
  body: fixtureIdSchema,
};

export const updateFixture = {
  body: updateFixtureSchema,
  params: fixtureIdSchema,
};
export const fixtureVMListSchema = joi.object( {
  clientId: joi.string().required(),
  limit: joi.number().required(),
  offset: joi.number().required(),
  sortColumnName: joi.string().required().allow( '' ),
  sortBy: joi.number().required().allow( '' ),
  searchValue: joi.string().required().allow( '' ),
  filter: joi.object( {
    status: joi.array().items( joi.any() ).min( 0 ),
    type: joi.array().items( joi.any() ).min( 0 ),
    size: joi.array().items( joi.any() ).min( 0 ).optional(),
    brand: joi.array().items( joi.any() ).min( 0 ).optional(),
    category: joi.array().items( joi.any() ).min( 0 ).optional(),
    subCategory: joi.array().items( joi.any() ).min( 0 ).optional(),
  } ).required(),
  export: joi.boolean().required(),
  emptyDownload: joi.boolean().required(),
} );

export const fixtureList = {
  body: fixtureVMListSchema,
};

export const addVmTypeSchema = joi.object( {
  clientId: joi.string().required(),
  vmData: joi.array().items( joi.any() ).min( 1 ).required(),
} );

export const addVmType = {
  body: addVmTypeSchema,
};

export const getClientSchema = joi.object( {
  clientId: joi.string().required(),
} );

export const getClient = {
  query: getClientSchema,
};

export const brandSchema = joi.object( {
  clientId: joi.string().required(),
  export: joi.boolean().optional(),
  emptyDownload: joi.boolean().optional(),
} );

export const brandDetails ={
  body: brandSchema,
};

export const deleteVMTypeImageSchema = joi.object( {
  vmId: joi.string().required(),
  index: joi.number().required(),
} );

export const deleteVMTypeImage = {
  body: getClientSchema,
};

export const updateTaskConfigSchema = joi.object( {
  clientId: joi.string().required(),
  dueDay: joi.number().required(),
  dueTime: joi.string().required(),
  allowedStoreLocation: joi.boolean().required(),
} );

export const updateTaskConfig = {
  body: updateTaskConfigSchema,
};

export const uploadBrandListSchema = joi.object( {
  clientId: joi.string().required(),
  brandData: joi.array().items( joi.any() ).min( 1 ).required(),
  brandUsedList:joi.array().items(joi.any()).min(0)
} );

export const uploadBrandList = {
  body: uploadBrandListSchema,
};

export const fixtureBulkUploadSchema = joi.object( {
  clientId: joi.string().required(),
  fixtureData: joi.array().items( joi.any() ).min( 1 ).required(),
  newFixtureStatus: joi.string().optional(),
  updateFixtureStatus: joi.string().optional(),
  deleteFixtureList: joi.array().items( joi.any() ).min( 0 ),
} );

export const fixtureBulkUpload = {
  body: fixtureBulkUploadSchema,
};

export const addUpdateBrandSchema = joi.object( {
  clientId: joi.string().required(),
  brandUsedList: joi.array().items( joi.any() ).min( 0 ).required(),
  brandData: joi.array().items( joi.any() ).min( 1 ).required(),
} );

export const addUpdateBrand = {
  body: addUpdateBrandSchema,
};

export const getVmDetailsSchema = joi.object( {
  vmId: joi.string().required(),
} );

export const getVmDetails = {
  query: getVmDetailsSchema,
};

export const deleteVmLibSchema = joi.object( {
  vmId: joi.string().required(),
} );

export const deleteVmLib = {
  body: deleteVmLibSchema,
};

export const addUpdateVmSchema = joi.object( {
  clientId: joi.string().required(),
  vmName: joi.string().required(),
  vmType: joi.string().required(),
  vmBrand: joi.string().required(),
  vmSubBrand: joi.string().optional().allow( '' ),
  vmCategory: joi.string().optional().allow( '' ),
  vmSubCategory: joi.string().optional().allow( '' ),
  vmHeight: joi.object( {
    value: joi.number().required(),
    unit: joi.string().required(),
  } ).required(),
  vmWidth: joi.object( {
    value: joi.number().required(),
    unit: joi.string().required(),
  } ).required(),
  vmImageUrl: joi.string().optional(),
  isDoubleSided: joi.boolean().required(),
  status: joi.string().required(),
  _id: joi.string().optional(),
} );

export const addUpdateVm = {
  body: addUpdateVmSchema,
};

export const vmBulkUploadSchema = joi.object( {
  clientId: joi.string().required(),
  vmData: joi.array().items( joi.any() ).min( 1 ).required(),
  newVmStatus: joi.string().required(),
  updateVmStatus: joi.string().required(),
  deleteVmList: joi.array().required(),
} );

export const vmBulkUpload = {
  body: vmBulkUploadSchema,
};

export const createTemplateSchema = joi.object( {
  clientId: joi.string().required(),
  fixtureLibraryId: joi.string().required(),
} );

export const createTemplate = {
  body: createTemplateSchema,
};

export const templateIdSchema = joi.object( {
  templateId: joi.string().required(),
} );

export const templateId = {
  body: templateIdSchema,
};

export const queryTemplateId = {
  query: templateIdSchema,
};

export const updateFixtureTaskSchema = joi.object( {
  endDate: joi.string().required(),
  clientId: joi.string().required(),
  storeList: joi.array().items( joi.any() ).min( 1 ).required(),
  endTime: joi.string().required(),
  geoFencing: joi.boolean().required(),
} );

export const updateFixtureTask = {
  body: updateFixtureTaskSchema,
};

