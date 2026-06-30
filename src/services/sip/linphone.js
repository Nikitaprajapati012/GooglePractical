import { NativeModules, Platform } from 'react-native';

const { LinphoneRNModule } = NativeModules || {};

function missingModuleError() {
  return new Error(
    'LinphoneRNModule native bridge is not available. ' +
      'Make sure you implemented @ReactMethod/iOS exported module and registered it. ' +
      'Expected NativeModules.LinphoneRNModule.',
  );
}

export async function sipRegister({ domain, credentials } = {}) {
  if (!LinphoneRNModule?.register) throw missingModuleError();

  // Native side should handle start + create/register accounts.
  return await LinphoneRNModule.register({ domain, credentials });
}

export async function sipUnregister() {
  if (!LinphoneRNModule?.unregister) throw missingModuleError();
  return await LinphoneRNModule.unregister();
}

export function getLinphonePlatformInfo() {
  return {
    platform: Platform.OS,
    nativeAvailable: !!LinphoneRNModule,
    hasRegister: typeof LinphoneRNModule?.register === 'function',
    hasUnregister: typeof LinphoneRNModule?.unregister === 'function',
  };
}
