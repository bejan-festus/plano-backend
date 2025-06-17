import model from 'tango-api-schema';

export async function aggregate( query = [] ) {
  return await model.checklistassignconfigModel.aggregate( query );
}


