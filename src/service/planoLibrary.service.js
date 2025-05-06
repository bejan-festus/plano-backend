import model from 'tango-api-schema';

export const findOne = async ( query={}, field={} ) => {
  return await model.fixtureLibraryModel.findOne( query, field );
};

export const findAndSort = async ( query={}, field={}, sort={} ) => {
  return await model.fixtureLibraryModel.findOne( query, field ).sort( sort ).collation( { locale: 'en_US', numericOrdering: true } );
};

export const find = async ( query={}, field={} ) => {
  return await model.fixtureLibraryModel.find( query, field );
};

export const updateOne = async ( query={}, record={} ) => {
  return await model.fixtureLibraryModel.updateOne( query, { $set: record } );
};

export const deleteOne = async ( query={} ) => {
  return await model.fixtureLibraryModel.deleteOne( query );
};

export const insertMany = async ( data = [] ) => {
  return await model.fixtureLibraryModel.insertMany( data );
};

export const create = async ( data = {} ) => {
  return await model.fixtureLibraryModel.create( data );
};

export const aggregate = async ( query=[] ) => {
  return await model.fixtureLibraryModel.aggregate( query );
};
