export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Obtiene la fecha y hora actual en formato ISO.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export const toolHandlers: Record<string, Function> = {
  get_current_time: () => {
    return new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  },
};
