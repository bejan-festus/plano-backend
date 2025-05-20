import model from 'tango-api-schema';

export const findOne = async ( query ={}, field = {} ) => {
  return model.vmTypeModel.findOne( query, field );
};

export const deleteOne = async ( query ={} ) => {
  return model.vmTypeModel.deleteOne( query );
};

export const deleteMany = async ( query ={} ) => {
  return model.vmTypeModel.deleteMany( query );
};

export const create = async ( data ) => {
  return model.vmTypeModel.create( data );
};

export const find = async ( query ={}, field = {} ) => {
  return model.vmTypeModel.find( query, field );
};

export const updateOne = async ( query ={}, record = {} ) => {
  return model.vmTypeModel.updateOne( query, { $set: record } );
};

export const updateKeys = async ( query ={}, record = {} ) => {
  return model.vmTypeModel.updateOne( query, record );
};

export const insertMany = async ( data ) => {
  return model.vmTypeModel.insertMany( data );
};
