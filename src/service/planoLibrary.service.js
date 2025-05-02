import model from 'tango-api-schema';

export const findOne = async ( query={}, record={} ) => {
  return await model.fixtureLibraryModel.findOne( { query, record } );
};

export const find = async ( query={}, record={} ) => {
  return await model.fixtureLibraryModel.find( { query, record } );
};
