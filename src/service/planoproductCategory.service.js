import model from 'tango-api-schema';

export const findOne = async ( query={}, field={} ) => {
  return await model.planoProductCategoryModel.findOne( query, field );
};

export const findAndSort = async ( query={}, field={}, sort={} ) => {
  return await model.planoProductCategoryModel.find( query, field ).sort( sort ).collation( { locale: 'en_US', numericOrdering: true } );
};

export const find = async ( query={}, field={} ) => {
  return await model.planoProductCategoryModel.find( query, field );
};

export const updateOne = async ( query={}, record={} ) => {
  return await model.planoProductCategoryModel.updateOne( query, { $set: record }, { upsert: true } );
};

export const deleteOne = async ( query={} ) => {
  return await model.planoProductCategoryModel.deleteOne( query );
};

export const insertMany = async ( data = [] ) => {
  return await model.planoProductCategoryModel.insertMany( data );
};

export const deleteMany = async ( data = [] ) => {
  return await model.planoProductCategoryModel.deleteMany( data );
};

export const create = async ( data = {} ) => {
  return await model.planoProductCategoryModel.create( data );
};

export const aggregate = async ( query=[] ) => {
  return await model.planoProductCategoryModel.aggregate( query );
};

export async function upsertOne( query, record ) {
  return model.planoProductCategoryModel.findOneAndUpdate(
      query,
      record,
      { upsert: true, new: true },
  );
}


