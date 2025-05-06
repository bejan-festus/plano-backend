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
  fixtureName: joi.string().required(),
  fixtureType: joi.string().required(),
  clientId: joi.string().required(),
} );

export const createFixture = {
  body: createFixtureSchema,
};

export const updateFixtureSchema = joi.object( {
  fixtureWidth: joi.number().optional(),
  fixtureHeight: joi.number().optional(),
  fixtureName: joi.number().optional(),
  fixtureLength: joi.number().optional(),
  shelfCount: joi.number().optional(),
  shelfConfig: joi.array().optional(),
  panelConfig: joi.array().optional(),
  status: joi.string().required(),
} );

export const fixtureIdSchema = joi.object( {
  fixtureId: joi.string().required(),
} );

export const updateFixture = {
  body: updateFixtureSchema,
  params: fixtureIdSchema,
};
export const fixtureListSchema = joi.object( {
  clientId: joi.string().required(),
  limit: joi.number().required(),
  offset: joi.number().required(),
  sortColumnName: joi.string().required().allow( '' ),
  sortBy: joi.number().required().allow( '' ),
  searchValue: joi.string().required().allow( '' ),
  filter: joi.object( {
    status: joi.array().items( joi.any() ).min( 0 ),
    type: joi.array().items( joi.any() ).min( 0 ),
    size: joi.array().items( joi.any() ).min( 0 ),
  } ).required(),
} );

export const fixtureList = {
  body: fixtureListSchema,
};

