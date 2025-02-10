import model from 'tango-api-schema';

export async function findOne( query = {}, field={} ) {
  return await model.userModel.findOne( query, field );
}

export const aggregate = async ( query = {} ) => {
  return model.userModel.aggregate( query );
};

export async function create( data ) {
  return model.userModel.create( data );
}

