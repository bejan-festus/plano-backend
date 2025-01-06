import joi from 'joi';

export const createBuilderSchema = {
  storeName: joi.string().required(),
  storeId: joi.string().required(),
  clientId: joi.string().required(),
  floorNumber: joi.number().required(),
};

export const createBuilder = joi.object( {
  body: createBuilderSchema,
} );

export const updateStoreLayoutSchema = {
  id: joi.string().required(),
  layoutPolygon: joi.array().required(),
  status: joi.string().required(),
};

export const updateStoreLayout = joi.object( {
  body: updateStoreLayoutSchema,
} );

export const storeLayoutListSchema = {
  limit: joi.number().required(),
  offset: joi.number().required(),
  filter: joi.array().items( joi.any() ).min( 0 ),
  searchValue: joi.string().required().allow( '' ),
  sortColumnName: joi.string().required().allow( '' ),
  sortBy: joi.string().required().allow( '' ),
};

export const storeLayoutList = joi.object( {
  body: storeLayoutListSchema,
} );

export const updateFloorSchema = {
  id: joi.string().required(),
  floorNumber: joi.number().required(),
};

export const updateFloor = joi.object( {
  body: updateFloorSchema,
} );


