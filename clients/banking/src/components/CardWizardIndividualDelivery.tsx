import { Future, Option } from "@swan-io/boxed";
import { Avatar } from "@swan-io/lake/src/components/Avatar";
import { Box } from "@swan-io/lake/src/components/Box";
import { Fill } from "@swan-io/lake/src/components/Fill";
import { LakeAlert } from "@swan-io/lake/src/components/LakeAlert";
import { LakeButton } from "@swan-io/lake/src/components/LakeButton";
import { LakeText } from "@swan-io/lake/src/components/LakeText";
import { Space } from "@swan-io/lake/src/components/Space";
import { Tile } from "@swan-io/lake/src/components/Tile";
import { commonStyles } from "@swan-io/lake/src/constants/commonStyles";
import { colors } from "@swan-io/lake/src/constants/design";
import { isNotNullish } from "@swan-io/lake/src/utils/nullish";
import { GetNode } from "@swan-io/lake/src/utils/types";
import { LakeModal } from "@swan-io/shared-business/src/components/LakeModal";
import { CountryCCA3 } from "@swan-io/shared-business/src/constants/countries";
import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";
import { P, match } from "ts-pattern";
import axios from 'axios';
import {  useForm } from "@swan-io/use-form";
import { LakeLabel } from "@swan-io/lake/src/components/LakeLabel";
import { Item } from "@swan-io/lake/src/components/LakeSelect";

import {
  CompleteAddressWithContactInput,
  GetEligibleCardMembershipsQuery,
} from "../graphql/partner";
import { getMemberName } from "../utils/accountMembership";
import { t } from "../utils/i18n";
import { validateAddressLine } from "../utils/validations";
import { Address, CardWizardAddressForm } from "./CardWizardAddressForm";
import { CardWizardChoosePinModal } from "./CardWizardChoosePinModal";
import { LakeSelect } from "@swan-io/lake/src/components/LakeSelect";

const styles = StyleSheet.create({
  erroredTile: {
    borderColor: colors.negative[100],
    borderWidth: 1,
  },
});

type Member = GetNode<NonNullable<GetEligibleCardMembershipsQuery["account"]>["memberships"]>;

type CardIndividualDeliveryConfig = {
  address: CompleteAddressWithContactInput;
  member: Member;
  choosePin: boolean;
}[];

type Props = {
  members: Member[];
  address?: CompleteAddressWithContactInput;
  onSubmit: (cardDeliveryConfig: CardIndividualDeliveryConfig) => Future<unknown>;
};

export type CardWizardIndividualDeliveryRef = { submit: () => void };

type PropsWithAddress = {
  members: Member[];
  address: CompleteAddressWithContactInput;
  onSubmit: (cardDeliveryConfig: CardIndividualDeliveryConfig) => void;
};

type SuggestedAddress = {
  address: string;
  code: string;
};

const CardWizardIndividualDeliveryWithAddress = forwardRef<
  CardWizardIndividualDeliveryRef,
  PropsWithAddress
>(({ members, address, onSubmit }: PropsWithAddress, ref) => {
  const [currentCardIndividualDeliveryConfig, setCardIndividualDeliveryConfig] =
    useState<CardIndividualDeliveryConfig>(() =>
      members.map(member => ({ member, address, choosePin: false })),
    );

  const [editingAddress, setEditingAddress] = useState<[Address, number] | null>(null);
  const [suggestedAddresses, setSuggestedAddresses] = useState<Item<{
    adresse: string;
    code: string;
  }>[]>([]);

  const hasSomeError = currentCardIndividualDeliveryConfig.some(config =>
    isNotNullish(validateAddressLine(config.address.addressLine1)),
  );

  useImperativeHandle(
    ref,
    () => ({
      submit: () => {
        if (!hasSomeError) {
          onSubmit(currentCardIndividualDeliveryConfig);
        }
      },
    }),
    [currentCardIndividualDeliveryConfig, hasSomeError, onSubmit],
  );

  const { Field } = useForm<{
    selectedAddress: string | undefined;
  }>({
    selectedAddress: {
      initialValue: undefined,
    }
  });

  return (
    <View>
      {currentCardIndividualDeliveryConfig.map((config, index) => {
        const hasError = isNotNullish(validateAddressLine(config.address.addressLine1));

        return (
          <View key={config.member.id}>
            <Tile
              style={hasError ? styles.erroredTile : null}
              footer={
                hasError ? (
                  <LakeAlert
                    anchored={true}
                    variant="error"
                    title={t("cardWizard.address.tooLong")}
                  />
                ) : null
              }
            >
              <Box direction="row" alignItems="center">
                <Avatar size={28} user={config.member.user} />
                <Space width={24} />

                <View style={commonStyles.fill}>
                  <LakeText variant="semibold" color={colors.gray[900]}>
                    {getMemberName({ accountMembership: config.member })}
                  </LakeText>

                  <LakeText>{config.address.addressLine1}</LakeText>

                  {config.address.addressLine2 != null ? (
                    <LakeText>{config.address.addressLine2}</LakeText>
                  ) : null}

                  <LakeText>
                    {`${config.address.postalCode} ${config.address.city} ${
                      config.address.state ?? ""
                    } ${config.address.country}`.trim()}
                  </LakeText>
                </View>

                <Fill minWidth={24} />

                <LakeButton
                  mode="tertiary"
                  onPress={() =>
                    setEditingAddress([
                      {
                        addressLine1: config.address.addressLine1,
                        addressLine2: config.address.addressLine2 ?? undefined,
                        postalCode: config.address.postalCode,
                        city: config.address.city,
                        state: config.address.state ?? undefined,
                        country: config.address.country as CountryCCA3,
                      },
                      index,
                    ])
                  }
                >
                  {t("cardWizard.address.change")}
                </LakeButton>
              </Box>
            </Tile>

            <Space height={16} />
          </View>
        );
      })}

      <LakeModal visible={editingAddress != null} title={t("cardWizard.address.changeAddress")}>
        {(() => {
          if (editingAddress != null) {
            const [initialAddress, editingIndex] = editingAddress;

            return (
              <>
              <CardWizardAddressForm
                initialAddress={initialAddress}
                onSubmit={address => {
                  setCardIndividualDeliveryConfig(
                    currentCardIndividualDeliveryConfig.map((item, index) => {

                      const { addressLine1, postalCode, city} = item.address
                      const formatedAddress = `${addressLine1} ${postalCode} ${city}`

                      // filter 5 first address of response
                      // add this address to a state
                      // display a select with this address at bottom of the form

                      axios.get('https://local.assoconnect-dev.com/services/laposte/address-control', {
                        params: { q: formatedAddress },
                      })
                        .then(response => {
                          console.log("RESPONSE !!!!", response.data.result);
                          setSuggestedAddresses(response.data.result.slice(0, 5));
                        })
                        .catch(error => {
                          console.error('Error:',  error);
                        });                
                    


                      if (editingIndex !== index) {
                        return item;
                      }
                      return {
                        ...item,
                        address: {
                          firstName: item.address.firstName,
                          lastName: item.address.lastName,
                          phoneNumber: item.address.phoneNumber,
                          ...address,
                        },
                      };
                    }),
                  );
                  // setEditingAddress(null);
                }}
                onPressClose={() => setEditingAddress(null)}
              />
              {suggestedAddresses.length > 0 && (
                              //   <LakeSelect
                              //   id={id}
                              //   ref={ref}
                              //   items={suggestedAddresses}
                              //   value={value}
                              //   onValueChange={(value)=> console.log(value)}
                              // />
                              <Field name="selectedAddress">
                              {({ value, ref }) => (
                                <LakeLabel
                                  label={t("card.address.form.select")}
                                  render={id => (
                                    <LakeSelect
                                      id={id}
                                      ref={ref}
                                      items={suggestedAddresses.map((value) => ({
                                        value: value.code,
                                        name: value.adresse,
                                      }))}
                                      value={value}
                               onValueChange={(value)=> console.log(value)}
                              />
                                  )}
                                />
                              )}
                            </Field>
        )}
              {/* {suggestedAddresses?.map((address, index) => {
                return (
                  <LakeButton
                    key={index}
                    onPress={() => {
                      const config = members.map(member => ({
                        member,
                        address: {
                          addressLine1: address.address,
                          postalCode: address.code,
                          city: "",
                          country: "FRA",
                        },
                        choosePin: false,
                      }));
                      // setChoosePinModal(Option.Some(config));
                    }}
                  >
                    {address.address}
                  </LakeButton>
                )
            })} */}
            </>
            );
          }
          return null;
        })()}
      </LakeModal>
    </View>
  );
});

export const CardWizardIndividualDelivery = forwardRef<CardWizardIndividualDeliveryRef, Props>(
  ({ members, address, onSubmit }: Props, ref) => {
    const [choosePinModal, setChoosePinModal] = useState<Option<CardIndividualDeliveryConfig>>(
      Option.None(),
    );

    return (
      <>
        {address != null ? (
          <CardWizardIndividualDeliveryWithAddress
            ref={ref}
            members={members}
            address={address}
            onSubmit={value => {
              setChoosePinModal(Option.Some(value));
            }}
          />
        ) : (
          <Tile>
            <CardWizardAddressForm
              ref={ref}
              initialAddress={{ addressLine1: "", postalCode: "", city: "" }}
              showButtons={false}
              onSubmit={address => {
                const config = members.map(member => ({
                  member,
                  address: {
                    ...address,
                    firstName: member.user?.firstName ?? "",
                    lastName: member.user?.preferredLastName ?? "",
                    phoneNumber: member.user?.mobilePhoneNumber ?? "",
                  },
                  choosePin: false,
                }));
                setChoosePinModal(Option.Some(config));
              }}
            />
             
          </Tile>
        )}

        <CardWizardChoosePinModal
          visible={choosePinModal.isSome()}
          onPressClose={() => setChoosePinModal(Option.None())}
          onSubmit={({ choosePin }) =>
            match(choosePinModal)
              .with(Option.P.Some(P.select()), config => {
                return onSubmit(config.map(item => ({ ...item, choosePin })));
              })
              .otherwise(() => Future.value(undefined))
          }
        />
      </>
    );
  },
);
