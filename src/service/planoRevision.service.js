import model from 'tango-api-schema';

const planoRevisionModel = model.planoRevisionModel;

export const findOne = async ( query = {}, field = {} ) => {
  return await planoRevisionModel.findOne( query, field );
};

export const find = async ( query = {}, field = {} ) => {
  return await planoRevisionModel.find( query, field );
};

export const create = async ( data = {} ) => {
  return await planoRevisionModel.create( data );
};
