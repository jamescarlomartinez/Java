package com.company;

public class Main {

    public static void main(String[] args) {
	int [] numbers = {1,2,3,4,5};
        {
            for (int x : numbers)
            {
                System.out.print(x + ",");
            }
        }


        String [] names = {"\n"+"\n"+"james", "carlo", "martinez"};
        {
            for (String name : names)
            {
                System.out.print(name+",");
            }
        }


    }
}
