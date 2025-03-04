import model from 'tango-api-schema';

export async function find( query = {}, field={} ) {
  return await model.checklistconfigModel.find( query, field );
}


