import type { InsuranceGroupId } from '../../../constants/insurance-groups';
import {
  COMPANY_ALIASES,
  COMPANY_TO_GROUP,
} from '../../../constants/insurance-groups';
import type { StateMachineInput, StateMachineOutput } from '../types';

function teslaResponse(input: StateMachineInput): StateMachineOutput {
  const url = input.config.cita_tesla_url;
  return {
    nextState: 'awaiting_human',
    messages: [
      'Al tratarse de un Tesla, nuestro tecnico especializado coordinara la peritacion y la reparacion en una sola visita, ' +
        'para que no tenga que venir dos veces.',
      url
        ? `Puede solicitar cita directamente aqui: ${url}`
        : 'En breve un asesor le facilitara el enlace para solicitar su cita.',
    ],
    action: url ? { type: 'send_link', url } : { type: 'escalate_to_human', reason: 'insurance_tesla' },
    requiresEntityExtraction: false,
  };
}

function buildGroupMessage(groupId: InsuranceGroupId, company: string): string {
  switch (groupId) {
    case 1:
      return (
        `Perfecto, hemos localizado su aseguradora: *${company}*.\n\n` +
        'Su compania requiere fotoperitacion previa. Una vez nos asigne como taller en la plataforma de su aseguradora, ' +
        'coordinaremos la fotoperitacion y le daremos cita.'
      );
    case 2:
      return (
        `Perfecto, hemos localizado su aseguradora: *${company}*.\n\n` +
        'Su compania asignara un perito de forma aleatoria. Una vez nos asigne como taller, ' +
        'le comunicaremos la fecha de peritacion.'
      );
    case 3:
      return (
        `Hemos identificado su aseguradora: *${company}* (Occident).\n\n` +
        'Le ofrecemos dos modalidades de peritacion:'
      );
    case 4:
      return (
        `Su aseguradora es *${company}* (Reale Seguros).\n\n` +
        'Su compania requiere videoperitacion, que debe realizarse en la proxima hora. ' +
        'Un asesor se pondra en contacto con usted de inmediato para coordinarla.'
      );
    case 5:
      return (
        `Su aseguradora es *${company}*.\n\n` +
        'Lamentablemente, esta compania no es colaboradora de nuestro taller, por lo que la reparacion ' +
        'requiere un pago anticipado por su parte. Le informamos de las ventajas de reparar con nosotros.'
      );
    case 6:
    default:
      return (
        `Hemos identificado su aseguradora: *${company}*.\n\n` +
        'Su compania gestiona un perito fisico presencial. Un asesor se pondra en contacto con usted ' +
        'para coordinar la visita del perito.'
      );
  }
}

export function handleNewRepairInsuranceCompany(input: StateMachineInput): StateMachineOutput {
  const raw = input.extractedEntities?.insurance_company_raw?.toLowerCase().trim();

  if (!raw) {
    // Not yet extracted — ask and signal extraction needed
    const isFirstAsk = input.conversation.state !== 'new_repair_insurance_company';
    return {
      nextState: 'new_repair_insurance_company',
      messages: isFirstAsk
        ? ['¿Con que compania aseguradora tiene contratada su poliza? Por favor, escriba el nombre.']
        : ['No he podido identificar la compania. ¿Podria escribir el nombre de su aseguradora de nuevo?'],
      action: null,
      requiresEntityExtraction: true,
    };
  }

  const canonical = COMPANY_ALIASES[raw];
  if (canonical === undefined) {
    return {
      nextState: 'new_repair_insurance_company',
      messages: [
        `No he reconocido "${raw}" como compania aseguradora. ` +
          'Por favor, escriba el nombre completo de su aseguradora (por ejemplo: Mapfre, Allianz, Zurich…).',
      ],
      action: null,
      requiresEntityExtraction: true,
    };
  }

  const groupId = COMPANY_TO_GROUP[canonical];
  const isTesla = input.vehicleData?.isTesla === true;

  // Group 3 + Tesla → Tesla special rule
  if (groupId === 3 && isTesla) {
    return teslaResponse(input);
  }

  const msg = buildGroupMessage(groupId, canonical);

  switch (groupId) {
    case 1:
    case 2:
      return {
        nextState: 'new_repair_insurance_assignment',
        messages: [msg],
        action: null,
        requiresEntityExtraction: false,
      };

    case 3:
      // Non-Tesla Occident
      return {
        nextState: 'new_repair_occident_choice',
        messages: [
          msg,
          '1. Peritacion en su domicilio (el perito acude en el dia y hora que usted elija)\n' +
            '2. Traer el vehiculo al taller (dejar toda la manana)\n\n' +
            'Indiqueme su preferencia.',
        ],
        action: null,
        requiresEntityExtraction: false,
      };

    case 4:
      return {
        nextState: 'awaiting_human',
        messages: [msg],
        action: { type: 'escalate_to_human', reason: 'insurance_reale' },
        requiresEntityExtraction: false,
      };

    case 5:
      return {
        nextState: 'new_repair_non_collab_no_peritar',
        messages: [
          msg,
          '¿Prefiere traer el vehiculo para que lo periten presencialmente, ' +
            'o necesita una valoracion sin desplazarse?',
        ],
        action: { type: 'send_pdf', document: 'ventajas_tesla' },
        requiresEntityExtraction: false,
      };

    case 6:
    default:
      return {
        nextState: 'awaiting_human',
        messages: [msg],
        action: { type: 'escalate_to_human', reason: 'insurance_standard' },
        requiresEntityExtraction: false,
      };
  }
}
