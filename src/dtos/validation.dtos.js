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

